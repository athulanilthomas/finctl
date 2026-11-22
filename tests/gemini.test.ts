import assert from 'node:assert/strict'
import { test } from 'node:test'
import { POST } from '../api/gemini.ts'
import { geminiBatchSize, geminiMerchantName, geminiMerchantNames, isGeminiResult } from '../src/lib/gemini.ts'
import { parseStatement } from '../src/lib/statement.ts'

const key = 'synthetic-api-key-for-tests'

function request(body: unknown, origin = 'https://finctl.test') {
  return new Request('https://finctl.test/api/gemini', {
    method: 'POST',
    headers: { origin, 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
  })
}

test('keeps recognizable merchants across the statement and excludes ambiguous payment narrations', () => {
  const { transactions } = parseStatement([[
    'HDFC Bank Credit Card Statement',
    'Domestic Transactions',
    '31/12/2025 AMAZON POS (Ref#987654321) C 85.00',
    '03/01/2026 AMAZON POS C 1,729.00',
    '04/01/2026 THIRD WAVE COFFEE C 608.00',
    '05/01/2026 CREDIT CARD PAYMENT + C 1,908.00',
    '06/01/2026 UPI JOHN EXAMPLE 123456789 C 900.00',
  ]])
  const names = geminiMerchantNames(transactions)
  assert.equal(names.size, 3)
  assert.deepEqual([...new Set(names.values())], ['THIRD WAVE COFFEE', 'AMAZON'])
  assert.equal(geminiMerchantName('UPI-ZOMATO 123456789'), 'ZOMATO')
  assert.equal(geminiMerchantName('POS STORE USD 12.99'), 'STORE')
  assert.equal(geminiMerchantName('EXAMPLE person@upi'), null)
  assert.equal(geminiMerchantName('STORE 12/01/2026'), null)
  assert.equal(geminiMerchantName('STORE +91 123 456 789'), null)
  assert.equal(geminiMerchantName('NEFT EXAMPLE'), null)
})

test('relays only names with a compact schema and validates Gemini responses', async (t) => {
  const names = ['THIRD WAVE COFFEE', 'AMAZON']
  const stub = t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent')
    assert.equal(new Headers(options.headers).get('x-goog-api-key'), key)
    const body = JSON.parse(String(options.body))
    assert.deepEqual(body.contents, [{ parts: [{ text: JSON.stringify(names) }] }])
    assert.equal(JSON.stringify(body).includes(key), false)
    assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, 'MINIMAL')
    assert.equal(body.generationConfig.maxOutputTokens, 38)
    assert.equal(body.generationConfig.responseJsonSchema.type, 'array')
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '[1,3]' }] } }] })
  })
  const response = await POST(request(names))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
  assert.deepEqual(await response.json(), [1, 3])
  assert.equal(stub.mock.callCount(), 1)
  assert.equal(isGeminiResult([1, 99], 2), false)
  assert.equal(isGeminiResult([1], 2), false)
})

test('rejects duplicate names, extra fields, or oversized requests before calling Gemini', async (t) => {
  const stub = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected request') })
  for (const body of [['AMAZON', 'AMAZON'], [{ name: 'AMAZON', amount: 100 }], ['STORE person@upi'], Array(geminiBatchSize + 1).fill('STORE')]) {
    assert.equal((await POST(request(body))).status, 400)
  }
  assert.equal((await POST(request(['AMAZON'], 'https://different.test'))).status, 403)
  assert.equal(stub.mock.callCount(), 0)
})

test('returns sanitized errors for bad keys, quota limits, and invalid model labels', async (t) => {
  const stub = t.mock.method(globalThis, 'fetch', async () => Response.json({ error: { details: [{ reason: 'API_KEY_INVALID' }] } }, { status: 400 }))
  assert.equal((await POST(request(['AMAZON']))).status, 401)
  stub.mock.mockImplementation(async () => new Response('private upstream details', { status: 429 }))
  const limited = await POST(request(['AMAZON']))
  assert.equal(limited.status, 429)
  assert.equal(await limited.text(), '')
  stub.mock.mockImplementation(async () => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '[999]' }] } }] }))
  assert.equal((await POST(request(['AMAZON']))).status, 502)
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { POST } from '../api/gemini.ts'
import { geminiModelHeader } from '../src/lib/gemini-models.ts'
import { classifyWithGemini, geminiBatchSize, geminiMerchantName, geminiMerchantNames, isGeminiResult } from '../src/lib/gemini.ts'
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
    assert.equal(body.generationConfig.maxOutputTokens, 256)
    assert.deepEqual(body.generationConfig.responseJsonSchema, {
      type: 'array', items: { type: 'integer', minimum: 0, maximum: 11 }, minItems: 2, maxItems: 2,
    })
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

test('routes selected models with their supported thinking level and a bounded output', async (t) => {
  const stub = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '[3]' }] } }] }),
  )
  for (const model of ['gemini-4-hydrogen', 'gemini-4-neon']) {
    const selection = request(['AMAZON'])
    selection.headers.set(geminiModelHeader, model)
    assert.deepEqual(await (await POST(selection)).json(), [3])
    const [url, options] = stub.mock.calls.at(-1)?.arguments ?? []
    assert.equal(url, `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`)
    assert.ok(options)
    assert.equal(new Headers(options.headers).has(geminiModelHeader), false)
    const body = JSON.parse(String(options.body))
    assert.deepEqual(body.contents, [{ parts: [{ text: '["AMAZON"]' }] }])
    assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, 'LOW')
    assert.equal(body.generationConfig.maxOutputTokens, 1024)
  }
  assert.equal(stub.mock.callCount(), 2)
})

test('identifies truncated responses, blocks, invalid outputs, and upstream request failures', async (t) => {
  const stub = t.mock.method(globalThis, 'fetch', async () => Response.json({ candidates: [{ finishReason: 'MAX_TOKENS' }] }))
  assert.deepEqual(await (await POST(request(['AMAZON']))).json(), { error: 'incomplete' })
  stub.mock.mockImplementation(async () => Response.json({ promptFeedback: { blockReason: 'SAFETY' } }))
  assert.deepEqual(await (await POST(request(['AMAZON']))).json(), { error: 'blocked' })
  stub.mock.mockImplementation(async () => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '[]' }] } }] }))
  assert.deepEqual(await (await POST(request(['AMAZON']))).json(), { error: 'invalid_output' })
  stub.mock.mockImplementation(async () => Response.json({ error: { message: 'private details' } }, { status: 400 }))
  assert.deepEqual(await (await POST(request(['AMAZON']))).json(), { error: 'request_rejected' })
  stub.mock.mockImplementation(async () => Response.json({ error: { message: 'private details' } }, { status: 404 }))
  assert.deepEqual(await (await POST(request(['AMAZON']))).json(), { error: 'model_unavailable' })
  stub.mock.mockImplementation(async () => { throw new Error('private details') })
  assert.deepEqual(await (await POST(request(['AMAZON']))).json(), { error: 'unavailable' })
})

test('rejects invalid merchant batches and unlisted models before calling Gemini', async (t) => {
  const stub = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected request') })
  for (const body of [['AMAZON', 'AMAZON'], [{ name: 'AMAZON', amount: 100 }], ['STORE person@upi'], Array(geminiBatchSize + 1).fill('STORE')]) {
    assert.equal((await POST(request(body))).status, 400)
  }
  for (const model of ['__proto__', 'gemini-invalid', 'https://example.com/model']) {
    const selection = request(['AMAZON'])
    selection.headers.set(geminiModelHeader, model)
    const response = await POST(selection)
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: 'invalid_model' })
  }
  assert.equal((await POST(request(['AMAZON'], 'https://different.test'))).status, 403)
  assert.equal(stub.mock.callCount(), 0)
})

test('returns sanitized errors for bad keys, quota limits, and invalid model labels', async (t) => {
  const stub = t.mock.method(globalThis, 'fetch', async () => Response.json({ error: { details: [{ reason: 'API_KEY_INVALID' }] } }, { status: 400 }))
  const invalid = await POST(request(['AMAZON']))
  assert.equal(invalid.status, 401)
  assert.deepEqual(await invalid.json(), { error: 'invalid_key' })
  stub.mock.mockImplementation(async () => new Response('private upstream details', { status: 429 }))
  const limited = await POST(request(['AMAZON']))
  assert.equal(limited.status, 429)
  assert.deepEqual(await limited.json(), { error: 'quota' })
  stub.mock.mockImplementation(async () => Response.json({ error: { details: [{ reason: 'API_KEY_HTTP_REFERRER_BLOCKED' }] } }, { status: 403 }))
  const restricted = await POST(request(['AMAZON']))
  assert.equal(restricted.status, 403)
  assert.deepEqual(await restricted.json(), { error: 'restricted_key' })
  stub.mock.mockImplementation(async () => Response.json({ error: { status: 'PERMISSION_DENIED', message: 'private project details' } }, { status: 403 }))
  assert.deepEqual(await (await POST(request(['AMAZON']))).json(), { error: 'project_access' })
  stub.mock.mockImplementation(async () => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '[999]' }] } }] }))
  assert.equal((await POST(request(['AMAZON']))).status, 502)
})

test('uses the public preview origin and forwards credentials without assuming a key format', async (t) => {
  const auth = 'synthetic.key-with+punctuation'
  const stub = t.mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) => {
    assert.equal(new Headers(options.headers).get('x-goog-api-key'), auth)
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '[3]' }] } }] })
  })
  const previewRequest = new Request('http://localhost:3000/api/gemini', {
    method: 'POST',
    headers: {
      origin: 'https://preview.finctl.test',
      'x-forwarded-host': 'preview.finctl.test',
      'x-forwarded-proto': 'https',
      'Content-Type': 'application/json',
      'x-goog-api-key': auth,
    },
    body: JSON.stringify(['AMAZON']),
  })
  const response = await POST(previewRequest)
  assert.equal(response.status, 200)
  assert.equal(stub.mock.callCount(), 1)
  assert.deepEqual(await (await POST(request(['AMAZON'], 'https://different.test'))).json(), { error: 'preview_origin' })
})

test('separates Vercel preview authentication from Google key and project errors', async (t) => {
  const stub = t.mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) => {
    assert.equal(new Headers(options.headers).get(geminiModelHeader), 'gemini-4-hydrogen')
    assert.deepEqual(JSON.parse(String(options.body)), ['AMAZON'])
    return Response.json({
      error: { message: 'Protected deployment', code: '401' },
      message: 'Protected by Vercel Authentication',
    }, { status: 401 })
  })
  const classify = () => classifyWithGemini(['AMAZON'], key, new AbortController().signal, 'gemini-4-hydrogen')
  await assert.rejects(classify, /Vercel blocked the request/)
  stub.mock.mockImplementation(async () => Response.json({ error: 'preview_origin' }, { status: 403 }))
  await assert.rejects(classify, /preview did not accept the request origin/)
  stub.mock.mockImplementation(async () => Response.json({ error: 'invalid_key' }, { status: 401 }))
  await assert.rejects(classify, /Google could not authenticate this key/)
  stub.mock.mockImplementation(async () => Response.json({ error: 'project_access' }, { status: 403 }))
  await assert.rejects(classify, /Google denied this project access/)
  stub.mock.mockImplementation(async () => Response.json({ error: 'model_unavailable' }, { status: 404 }))
  await assert.rejects(classify, /Choose another model to retry the remaining merchants/)
  stub.mock.mockImplementation(async () => new Response('FUNCTION_INVOCATION_FAILED', { status: 500 }))
  await assert.rejects(classify, /Vercel could not run the Gemini endpoint \(HTTP 500\)/)
  stub.mock.mockImplementation(async () => Response.json({ error: 'incomplete' }, { status: 502 }))
  await assert.rejects(classify, /Gemini hit its token limit/)
})

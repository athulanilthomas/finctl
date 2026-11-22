import { categories, categorize } from './categories.ts'
import type { Category } from './categories.ts'
import type { Transaction } from './statement.ts'

export const geminiBatchSize = 40
export const geminiCategories: Category[] = ['uncategorized', ...categories.filter((category) => category !== 'uncategorized')]

const merchantCharacters = /^[\p{L}\p{M}\p{N} .,&'’+/-]+$/u
const embeddedDetails = /\d{4,}|\d+[./-]\d+|\b\d+\s+\d+\s+\d+\b|\b(?:REF|REFERENCE|UTR|RRN|TXN|AUTH|MID|TID)\s+[A-Z0-9-]*\d/i

export function isGeminiMerchantName(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 3 && value.length <= 80 && value.trim() === value &&
    /\p{L}/u.test(value) && merchantCharacters.test(value) && !embeddedDetails.test(value)
}

export function geminiMerchantName(description: string): string | null {
  const raw = description.normalize('NFKC').trim()
  const upi = /^UPI\b/i.test(raw)
  const name = raw
    .replace(/^(?:UPI|POS|ECOM)\s*[-:/ ]\s*/i, '')
    .replace(/\(\s*(?:REF|REFERENCE|UTR|RRN|TXN|AUTH)\b[^)]*\)/gi, ' ')
    .replace(/\s+\b(?:REF|REFERENCE|UTR|RRN|TXN|AUTH|MID|TID)\s*[:#-]?\s*[A-Z0-9-]*\d[A-Z0-9-]*\s*$/i, '')
    .replace(/\s+\b(?:USD|EUR|GBP|AED|AUD|CAD|SGD|JPY|INR)\s+[\d,.]+$/i, '')
    .replace(/\s+\d{5,}$/g, '')
    .replace(/\s+(?:POS|ECOM)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()

  if (!isGeminiMerchantName(name) || /^(?:NEFT|IMPS|RTGS)\b/i.test(raw) ||
    (upi && categorize(name) === 'uncategorized')) return null
  return name
}

export function geminiMerchantNames(transactions: Transaction[]) {
  const names = new Map<number, string>()
  for (const transaction of transactions) {
    if (transaction.kind !== 'purchase') continue
    const name = geminiMerchantName(transaction.description)
    if (name) names.set(transaction.id, name)
  }
  return names
}

export function isGeminiResult(value: unknown, count: number): value is number[] {
  return Array.isArray(value) && value.length === count &&
    value.every((id) => Number.isInteger(id) && id >= 0 && id < geminiCategories.length)
}

export async function classifyWithGemini(names: string[], key: string, signal: AbortSignal) {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(names),
    signal,
  })
  if (response.status === 401 || response.status === 403) {
    throw new Error('Gemini rejected this key. Check that it has access to Gemini.')
  }
  if (response.status === 429) throw new Error('Gemini reached the quota for this key. Try again later.')
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Gemini couldn’t finish this batch. You can retry the remaining merchants.')
  }

  const output: unknown = await response.json()
  if (!isGeminiResult(output, names.length)) throw new Error('Gemini returned invalid categories. Try again.')
  return output.map((id) => geminiCategories[id])
}

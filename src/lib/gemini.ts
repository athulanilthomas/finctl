import { categories, categorize, stripMerchantMetadata } from './categories.ts'
import type { Category } from './categories.ts'
import { defaultGeminiModel, geminiModelHeader } from './gemini-models.ts'
import type { GeminiModel } from './gemini-models.ts'
import type { Transaction } from './statement.ts'

export const geminiBatchSize = 40
export const geminiCategories: Category[] = ['uncategorized', ...categories.filter((category) => category !== 'uncategorized')]

const geminiErrors = {
  invalid_key: 'Google could not authenticate this key. Check it in Google AI Studio.',
  restricted_key: 'Google blocked requests from this server for this key. Use an authorization key created in Google AI Studio.',
  project_access: 'Google denied this project access to Gemini. Check the project status in Google AI Studio.',
  preview_origin: 'This preview did not accept the request origin. Open the Vercel preview directly and try again.',
  quota: 'Gemini reached the quota for this key. Try again later.',
  invalid_batch: 'The finctl endpoint rejected this merchant batch.',
  invalid_model: 'This model is no longer offered in finctl. Choose another model.',
  model_unavailable: 'This Gemini model is unavailable to your Google project. Choose another model to retry the remaining merchants.',
  request_rejected: 'Google rejected finctl’s categorization request.',
  incomplete: 'Gemini hit its token limit before finishing this batch.',
  blocked: 'Gemini blocked this batch under its content policies.',
  invalid_output: 'Gemini returned a category list that did not match the merchant batch.',
  unavailable: 'The finctl endpoint could not get a response from Gemini. You can retry the remaining merchants.',
  timed_out: 'Gemini did not respond in time. You can retry the remaining merchants.',
} as const

export type GeminiErrorCode = keyof typeof geminiErrors

const merchantCharacters = /^[\p{L}\p{M}\p{N} .,&'’+/-]+$/u
const embeddedDetails = /\d{4,}|\d+[./-]\d+|\b\d+\s+\d+\s+\d+\b|\b(?:REF|REFERENCE|UTR|RRN|TXN|AUTH|MID|TID)\s+[A-Z0-9-]*\d/i

export function isGeminiMerchantName(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 3 && value.length <= 80 && value.trim() === value &&
    /\p{L}/u.test(value) && merchantCharacters.test(value) && !embeddedDetails.test(value)
}

export function geminiMerchantName(description: string): string | null {
  const raw = description.normalize('NFKC').trim()
  const upi = /^UPI\b/i.test(raw)
  const name = stripMerchantMetadata(raw)
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

export async function classifyWithGemini(names: string[], key: string, signal: AbortSignal, model: GeminiModel = defaultGeminiModel) {
  if (!/^[!-~]+$/.test(key)) throw new Error('Paste the Gemini API key without spaces or line breaks.')
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key, [geminiModelHeader]: model },
    body: JSON.stringify(names),
    signal,
  })
  const isJson = response.headers.get('content-type')?.includes('application/json')
  if (!response.ok) {
    const body = isJson ? await response.json().catch(() => null) as { error?: unknown } | null : null
    const code = body?.error
    if (typeof code === 'string' && Object.hasOwn(geminiErrors, code)) {
      throw new Error(geminiErrors[code as GeminiErrorCode])
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('Vercel blocked the request. Sign in again and reopen the preview.')
    }
  }
  if (response.status === 404 || (response.ok && !isJson)) {
    throw new Error('The Gemini endpoint is missing from this deployment. Open the current Vercel preview.')
  }
  if (!response.ok) {
    throw new Error(`Vercel could not run the Gemini endpoint (HTTP ${response.status}).`)
  }

  const output: unknown = await response.json()
  if (!isGeminiResult(output, names.length)) throw new Error('Gemini returned invalid categories. Try again.')
  return output.map((id) => geminiCategories[id])
}

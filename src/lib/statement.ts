import { categorize, merchantKey } from './categories.ts'
import type { Category } from './categories.ts'

export const transactionLabels = {
  purchase: 'Purchase',
  fee: 'Fees & interest',
  cash: 'Cash advances',
  payment: 'Card payment',
  credit: 'Refund or credit',
} as const

export type TransactionKind = keyof typeof transactionLabels

export type Transaction = {
  id: number
  date: string
  description: string
  amount: number
} & (
  | { kind: 'purchase'; category: Category; merchant: string }
  | { kind: Exclude<TransactionKind, 'purchase'> }
)

export type Statement = {
  transactions: Transaction[]
  unreadRows: number
  totalDifferences: { kind: 'charges' | 'credits'; read: number; printed: number }[]
}

const dateStart = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b(?:\s*\|?\s*\d{1,2}:\d{2}(?::\d{2})?)?\s*\|?\s*/
const amountEnd = /(?:^|\s)(?<sign>[+−-])?\s*(?<currency>₹|INR|RS\.?|C|`)?\s*(?<amountSign>[+−-])?\s*(?<value>\d[\d,]*\.\d{2})(?:\s*(?<marker>[+−-]|CR\.?|DR\.?|CREDIT|DEBIT))?(?:\s+[lI•●])?$/i
const wrappedDirection = /^(CR\.?|DR\.?|CREDIT|DEBIT)(?:\s+[lI•●])?$/i
const tableStart = /^(?:domestic|international)\s+(?:retail\s+)?transactions\b|^\s*(?:transaction\s+)?date\b.*\b(?:description|particulars|details)\b.*\bamount\b/i
const tableEnd = /^(?:transactions total amount|eligible for emi|important information|terms\s*(?:&|and)\s*conditions|payment options|reward points summary|offers on your card)\b/i
const pageFooter = /^page\s+\d+\s+of\s+\d+\b/i
const payment = /\b(?:(?:credit\s*)?card\s*payment(?:net)?|payment\s*(?:received|thank\s*you|via|by)|auto\s*pay|auto\s*debit|(?:neft|upi|imps)\s+payment)\b/i
const fee = /\b(?:[ics]?gst|finance charges?|interest(?: charges?| on| debited)|(?:annual|membership|joining|renewal|late payment|cash advance|processing|conversion|overlimit|forex|rent payment)\s+(?:fees?|charges?)|foreign currency mark[ -]?up|late fees?)\b|^interest$/i
const cash = /\b(?:cash advance|cash withdrawal|atm withdrawal)\b/i

function toPaise(value: string) {
  const [rupees, paise] = value.replaceAll(',', '').split('.')
  return Number(rupees) * 100 + Number(paise)
}

function toDate([, day, month, year]: RegExpMatchArray) {
  const fullYear = year.length === 2 ? `20${year}` : year
  const iso = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  const date = new Date(iso)
  return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(iso) ? iso : null
}

function parseRow(id: number, date: string | null, parts: string[]): Transaction | null {
  if (!date) return null

  const fields = []
  for (const [index, part] of parts.entries()) {
    const match = amountEnd.exec(part)
    if (!match?.groups) continue
    const prefix = part.slice(0, match.index)
    const { currency, value, sign, amountSign, marker } = match.groups
    if (!currency && /(?:\b(?:USD|EUR|GBP|AUD|SGD|JPY|CAD|AED)|[$€£])\s*$/i.test(prefix)) continue
    fields.push({ index, prefix, currency, value, sign: sign ?? amountSign, marker })
  }

  const field = fields.findLast(({ currency }) => currency) ?? fields.at(-1)
  if (!field) return null

  const { index, prefix, value, sign, marker } = field
  const description = [
    ...parts.slice(0, index),
    prefix.replace(/(?:\s{2,}[+-]?\s*|\s+[+-]\s*)\d[\d,]*$/, ''),
    ...parts.slice(index + 1).filter((part) => /^(?:\(?\s*ref\b|\d+\))/.test(part.toLowerCase())),
  ].join(' ').replace(/\s+/g, ' ').trim()
  const amount = toPaise(value)
  if (!description || !Number.isSafeInteger(amount)) return null

  const base = { id, date, description, amount }
  const direction = (marker ?? parts[index + 1]?.match(wrappedDirection)?.[1])?.toUpperCase()
  const isCredit = direction ? /^(?:CR|[+−-])/.test(direction) : Boolean(sign)

  if (isCredit) return { ...base, kind: payment.test(description) ? 'payment' : 'credit' }
  if (fee.test(description)) return { ...base, kind: 'fee' }
  if (cash.test(description)) return { ...base, kind: 'cash' }

  const merchant = merchantKey(description)
  return { ...base, kind: 'purchase', merchant, category: categorize(merchant) }
}

function comparePrintedTotals(lines: string[], transactions: Transaction[]): Statement['totalDifferences'] {
  const header = lines.findIndex((line) => /previous statement dues/i.test(line))
  if (header === -1) return []

  for (const line of lines.slice(header + 1, header + 6)) {
    const amounts = line.match(/\d[\d,]*\.\d{2}/g)
    if (amounts?.length !== 5) continue

    const [previous, credits, charges, interest, due] = amounts.map(toPaise)
    if (Math.abs(previous - credits + charges + interest - due) > 100) continue

    let actualCredits = 0
    let actualCharges = 0
    for (const { kind, amount } of transactions) {
      if (kind === 'credit' || kind === 'payment') actualCredits += amount
      else actualCharges += amount
    }
    const differences: Statement['totalDifferences'] = []
    const printedCharges = charges + interest
    if (actualCharges !== printedCharges) differences.push({ kind: 'charges', read: actualCharges, printed: printedCharges })
    if (actualCredits !== credits) differences.push({ kind: 'credits', read: actualCredits, printed: credits })
    return differences
  }

  return []
}

export function parseStatement(pages: string[][]): Statement {
  const header = pages[0]?.join(' ') ?? ''
  if (!/\bhdfc\s*bank\b/i.test(header) || !/\b(?:credit\s*card\s*statement|hdfc\s*bank\s*credit\s*cards?|previous statement dues)\b/i.test(header)) {
    throw new Error('Open a text-based HDFC Bank credit-card statement PDF.')
  }

  const transactions: Transaction[] = []
  let unreadRows = 0
  let inTable = false
  let pending: { date: string | null; parts: string[] } | null = null

  function finishRow() {
    if (!pending) return

    const transaction = parseRow(transactions.length, pending.date, pending.parts)
    if (transaction) transactions.push(transaction)
    else unreadRows++
    pending = null
  }

  for (const page of pages) {
    for (const rawLine of page) {
      const line = rawLine.trim()
      if (!line) continue
      if (pageFooter.test(line)) break

      const startsTable = tableStart.test(line)
      if (startsTable || tableEnd.test(line)) {
        finishRow()
        inTable = startsTable
        continue
      }
      if (!inTable) continue

      const date = line.match(dateStart)
      if (date) {
        finishRow()
        pending = { date: toDate(date), parts: [line.slice(date[0].length)] }
      } else {
        pending?.parts.push(line)
      }
    }
    finishRow()
  }

  if (!transactions.length) {
    throw new Error('No transactions could be read. Use a text-based HDFC credit-card statement with activity.')
  }

  return {
    transactions: transactions.sort((a, b) => b.date.localeCompare(a.date)),
    unreadRows,
    totalDifferences: comparePrintedTotals(pages[0], transactions),
  }
}

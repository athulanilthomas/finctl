import type { Category } from './categories.ts'
import type { Transaction, TransactionKind } from './statement.ts'

const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })
const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const rangeFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const monthFormat = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })

export const formatAmount = (paise: number) => rupees.format(paise / 100)
export const formatDate = (date: string) => dateFormat.format(new Date(date))
export const formatMonth = (month: string) => monthFormat.format(new Date(`${month}-01`))
export const formatRange = (start: string, end: string) => rangeFormat.formatRange(new Date(start), new Date(end))

export const monthsIn = (transactions: Transaction[]) =>
  [...new Set(transactions.map(({ date }) => date.slice(0, 7)))].sort().reverse()

export const allMonths = 'all'

export function transactionsForPeriod(transactions: Transaction[], period: string) {
  return period === allMonths ? transactions : transactions.filter(({ date }) => date.startsWith(period))
}

export type CategoryTotal = { category: Category; amount: number; count: number }

export function summarize(transactions: Transaction[]) {
  const totals: Record<TransactionKind, number> = { purchase: 0, fee: 0, cash: 0, payment: 0, credit: 0 }
  const categories = new Map<Category, CategoryTotal>()

  for (const transaction of transactions) {
    const { kind, amount } = transaction
    totals[kind] += amount
    if (kind !== 'purchase' || amount === 0) continue

    const { category } = transaction
    const group = categories.get(category) ?? { category, amount: 0, count: 0 }
    group.amount += amount
    group.count++
    categories.set(category, group)
  }

  const ranked = [...categories.values()].sort((a, b) => b.amount - a.amount)
  const largest = ranked.find(({ category }) => category !== 'uncategorized')
  return {
    totals,
    totalCharges: totals.purchase + totals.fee + totals.cash,
    ranked,
    largest,
    uncategorized: categories.get('uncategorized'),
  }
}

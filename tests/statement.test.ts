import assert from 'node:assert/strict'
import { test } from 'node:test'
import { monthsIn, summarize } from '../src/lib/report.ts'
import { parseStatement } from '../src/lib/statement.ts'

const title = 'HDFC Bank Credit Card Statement'
const columns = 'DATE & TIME  TRANSACTION DESCRIPTION  REWARDS  AMOUNT  PI'

const pages = [
  [
    title,
    'Domestic Transactions',
    columns,
    '31/12/2025 | 15:41  BLINKIT  + 20  C 1,299.10 l',
    '01/01/2026|09:00  CREDIT CARD PAYMENTNet Banking (Ref# 1234567890)  + C 12,000.00 l',
    '03/01/2026  22:51  ZOMATO  ₹ 449.95',
    '04/01/2026  Myntra refund INR 1,499.00 CR',
    '05/01/2026  IGST-ABC-RATE 18.0  C 95.43 l',
    '06/01/2026  ATM CASH WITHDRAWAL  C 2,000.00',
    'Page 1 of 2',
  ],
  [
    'International Transactions',
    columns,
    '08/01/2026  AMAZON MARKETPLACE USD 19.99',
    'C 1,697.54',
    '09/01/2026  INCOMPLETE ROW',
    '31/02/2026  INVALID DATE  C 1.21',
    'Important Information',
    '10/01/2026  Promotional offer  C 999.00',
  ],
]

test('reads signed charges and credits across statement pages', () => {
  const { transactions, unreadRows } = parseStatement(pages)
  assert.equal(unreadRows, 2)
  assert.deepEqual(transactions.map(({ date, kind, amount }) => [date, kind, amount]), [
    ['2026-01-08', 'purchase', 169754],
    ['2026-01-06', 'cash', 200000],
    ['2026-01-05', 'fee', 9543],
    ['2026-01-04', 'credit', 149900],
    ['2026-01-03', 'purchase', 44995],
    ['2026-01-01', 'payment', 1200000],
    ['2025-12-31', 'purchase', 129910],
  ])
  assert.equal(transactions.at(-1)?.description, 'BLINKIT')
  assert.deepEqual(monthsIn(transactions), ['2026-01', '2025-12'])

  const report = summarize(transactions.filter(({ date }) => date.startsWith('2026-01')))
  assert.equal(report.totals.purchase, 214749)
  assert.equal(report.totalCharges, 424292)
  assert.deepEqual(report.largest, { category: 'shopping', amount: 169754, count: 1 })
})

test('checks activity against printed statement totals when present', () => {
  const lines = [
    title,
    'PREVIOUS STATEMENT DUES  PAYMENTS/CREDITS  PURCHASES/DEBIT  FINANCE CHARGES  TOTAL AMOUNT DUE',
    'C100.00 - C90.00 + C42.00 + C2.99 = C55.00',
    'Domestic Transactions',
    columns,
    '01/01/2026  SWIGGY  C 42.00',
    '02/01/2026  PAYMENT THANKYOU  + C 90.00',
    '03/01/2026  FINANCE CHARGE  C 2.99',
  ]
  assert.deepEqual(parseStatement([lines]).totalDifferences, [])
  assert.deepEqual(parseStatement([lines.slice(0, -1)]).totalDifferences, [
    { kind: 'charges', read: 4200, printed: 4499 },
  ])
  assert.deepEqual(parseStatement([lines.filter((line) => !line.includes('PAYMENT THANKYOU'))]).totalDifferences, [
    { kind: 'credits', read: 0, printed: 9000 },
  ])
})

test('reconciles a sign after the currency and a wrapped credit marker', () => {
  const statement = parseStatement([[
    title,
    'PREVIOUS STATEMENT DUES  PAYMENTS/CREDITS  PURCHASES/DEBIT  FINANCE CHARGES  TOTAL AMOUNT DUE',
    'C100.00 - C95.00 + C42.00 + C0.00 = C47.00',
    'Domestic Transactions',
    columns,
    '01/01/2026  STORE C42.00',
    '02/01/2026  PAYMENT THANKYOU C+90.00',
    '03/01/2026  STORE REFUND C5.00',
    'CR',
  ]])

  assert.deepEqual(statement.transactions.map(({ description, kind, amount }) => [description, kind, amount]), [
    ['STORE REFUND', 'credit', 500],
    ['PAYMENT THANKYOU', 'payment', 9000],
    ['STORE', 'purchase', 4200],
  ])
  assert.equal(statement.unreadRows, 0)
  assert.deepEqual(statement.totalDifferences, [])
})

test('rejects a different statement type and rows without a settled amount', () => {
  assert.throws(() => parseStatement([['HDFC Bank Savings Statement', columns, '01/01/2026 ACCOUNT DEBIT 10.00']]), /credit-card statement/)
  assert.throws(() => parseStatement([[title, 'International Transactions', columns, '01/01/2026 STORE USD 10.00']]), /No transactions/)
})

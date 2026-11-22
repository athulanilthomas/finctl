import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, CircleAlert, CreditCard, Receipt, Sparkles } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Transactions } from '@/components/transactions'
import { categoryLabels } from '@/lib/categories'
import type { Category } from '@/lib/categories'
import { groupMerchants, localAiAvailability } from '@/lib/local-ai'
import { formatAmount, formatMonth, formatRange, monthsIn, summarize } from '@/lib/report'
import type { Statement } from '@/lib/statement'

const CategoryChart = lazy(() => import('@/components/category-chart'))
const chartColors = ['#206149', '#74a87d', '#c4a158', '#6c90ab', '#9b87aa', '#799389']

export default function Report({ statement, onClear }: { statement: Statement; onClear: () => void }) {
  const months = useMemo(() => monthsIn(statement.transactions), [statement])
  const [month, setMonth] = useState(months[0])
  const [filter, setFilter] = useState<Category | null>(null)
  const [edits, setEdits] = useState(() => new Map<number, Category>())
  const [modelLabels, setModelLabels] = useState(() => new Map<string, Category>())
  const [availability, setAvailability] = useState<Availability | null>(null)
  const [running, setRunning] = useState(false)
  const [download, setDownload] = useState<number | null>(null)
  const [aiError, setAiError] = useState(false)
  const aiRun = useRef<AbortController | null>(null)

  useEffect(() => {
    let cancelled = false
    void localAiAvailability().then((status) => { if (!cancelled) setAvailability(status) })
    return () => {
      cancelled = true
      aiRun.current?.abort()
    }
  }, [])

  const transactions = useMemo(() => statement.transactions
    .filter(({ date }) => date.startsWith(month))
    .map((transaction) => {
      if (transaction.kind !== 'purchase') return transaction
      return {
        ...transaction,
        category: edits.get(transaction.id) ?? modelLabels.get(transaction.merchant) ?? transaction.category,
      }
    }), [statement, month, edits, modelLabels])

  const { totals, totalCharges, ranked, largest, uncategorized } = useMemo(() => summarize(transactions), [transactions])
  const colors = ranked.map(({ category }, index) => category === 'uncategorized' ? '#c5cdc7' : chartColors[index % chartColors.length])
  const merchants = new Set<string>()
  for (const transaction of transactions) {
    if (transaction.kind !== 'purchase' || transaction.category !== 'uncategorized') continue
    const { id, merchant } = transaction
    if (merchant.length >= 3 && !edits.has(id) && !modelLabels.has(merchant)) merchants.add(merchant)
  }
  const aiSupported = availability !== null && availability !== 'unavailable'

  async function improveCategories() {
    if (aiRun.current || !merchants.size) return
    const controller = new AbortController()
    aiRun.current = controller
    setRunning(true)
    setAiError(false)

    try {
      await groupMerchants([...merchants], controller.signal, setDownload, (batch) => {
        if (!controller.signal.aborted) setModelLabels((previous) => new Map([...previous, ...batch]))
      })
      if (!controller.signal.aborted) setAvailability('available')
    } catch {
      if (!controller.signal.aborted) setAiError(true)
    } finally {
      aiRun.current = null
      if (!controller.signal.aborted) {
        setRunning(false)
        setDownload(null)
      }
    }
  }

  const activity = [
    { label: 'Total charges', amount: totalCharges, note: 'Purchases, fees and cash advances' },
    { label: 'Purchases', amount: totals.purchase, note: 'Before refunds and credits' },
    { label: 'Card payments', amount: totals.payment, note: 'Repayments to your card' },
    { label: 'Refunds & other credits', amount: totals.credit, note: 'Credits applied to your card' },
  ]

  return (
    <div className="grid gap-6">
      <section className="flex flex-wrap items-end justify-between gap-4" aria-labelledby="report-title">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <CreditCard className="size-4 text-primary" aria-hidden="true" /> HDFC credit card
          </p>
          <h1 id="report-title" className="mt-2 text-3xl font-semibold tracking-[-0.055em] sm:text-[2.85rem] sm:leading-tight">
            Monthly spending
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Transactions from {formatRange(transactions[transactions.length - 1].date, transactions[0].date)}, {month.slice(0, 4)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={month} onValueChange={(value) => {
            setMonth(value)
            setFilter(null)
          }}>
            <SelectTrigger aria-label="Report month" className="bg-card">
              <CalendarDays aria-hidden="true" /><SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {months.map((month) => <SelectItem key={month} value={month}>{formatMonth(month)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={onClear}>Clear report</Button>
        </div>
      </section>

      {(statement.unreadRows > 0 || statement.totalsMismatch) && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>
            {statement.unreadRows > 0 && `${statement.unreadRows} transaction ${statement.unreadRows === 1 ? 'row could' : 'rows could'} not be read. `}
            {statement.totalsMismatch && 'The parsed activity differs from the totals printed on the statement. '}
            Check the PDF before relying on this report.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.32fr]">
        <Card className="upload-shell justify-between border-0 py-5 text-white ring-0">
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="font-medium text-[#d5e7dc]">
              {largest && uncategorized && uncategorized.amount >= largest.amount ? 'Largest identified category' : 'Largest spending category'}
            </CardTitle>
            <Receipt className="size-5 text-[#c6e897]" aria-hidden="true" />
          </CardHeader>
          <CardContent className="pt-3">
            {largest ? (
              <>
                <p className="text-xl font-medium tracking-tight">{categoryLabels[largest.category]}</p>
                <p className="mt-1 text-[clamp(2rem,5vw,3.35rem)] leading-none font-semibold tracking-[-0.06em] text-[#d9f1aa] tabular-nums">
                  {formatAmount(largest.amount)}
                </p>
                <p className="mt-4 text-sm text-[#d5e7dc]">
                  {Math.round(100 * largest.amount / totals.purchase)}% of purchases · {largest.count} {largest.count === 1 ? 'purchase' : 'purchases'}
                  {uncategorized && ` · ${formatAmount(uncategorized.amount)} uncategorized`}
                </p>
              </>
            ) : (
              <p className="text-lg text-[#d5e7dc]">
                {uncategorized ? 'Categorize a purchase to see your largest category.' : 'No purchases this month.'}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Card activity</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-4">
              {activity.map(({ label, amount, note }) => (
                <div key={label} className="min-w-0 border-t pt-3">
                  <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5 text-[clamp(1.05rem,2vw,1.45rem)] font-semibold tracking-tight tabular-nums">{formatAmount(amount)}</dd>
                  <dd className="mt-1 hidden text-sm text-muted-foreground sm:block">{note}</dd>
                </div>
              ))}
            </dl>
            {(totals.fee > 0 || totals.cash > 0) && (
              <p className="mt-4 border-t pt-3 text-sm text-muted-foreground">
                {totals.fee > 0 && `Fees & interest ${formatAmount(totals.fee)}`}
                {totals.fee > 0 && totals.cash > 0 && ' · '}
                {totals.cash > 0 && `Cash advances ${formatAmount(totals.cash)}`}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {ranked.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Spending by category</CardTitle>
            <CardDescription>Select a category to see its purchases.</CardDescription>
          </CardHeader>
          <CardContent className="grid items-center gap-4 md:grid-cols-[minmax(0,15rem)_1fr] md:gap-8">
            <Suspense fallback={<div className="mx-auto size-57" aria-hidden="true" />}>
              <CategoryChart groups={ranked} colors={colors} total={totals.purchase} />
            </Suspense>
            <ul className="grid w-full gap-1">
              {ranked.map(({ category, count, amount }, index) => (
                <li key={category}>
                  <Button
                    variant={filter === category ? 'secondary' : 'ghost'}
                    className="h-auto w-full justify-start px-2 py-2.5 text-left hover:bg-accent"
                    aria-pressed={filter === category}
                    onClick={() => {
                      setFilter(filter === category ? null : category)
                      document.getElementById('transactions')?.scrollIntoView({ block: 'start' })
                    }}
                  >
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: colors[index] }} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{categoryLabels[category]}</span>
                    <span className="hidden text-muted-foreground sm:inline">{count} {count === 1 ? 'purchase' : 'purchases'}</span>
                    <span className="ml-2 tabular-nums">{formatAmount(amount)}</span>
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
          {(uncategorized || running || aiError) && (
            <CardContent>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted p-3 sm:px-4">
                <div className="min-w-0 flex-1 text-sm text-muted-foreground" role="status">
                  {running ? (
                    download !== null ? (
                      <>
                        <span>Downloading Chrome’s on-device model</span>
                        <Progress value={download * 100} aria-label="Model download" className="mt-2 max-w-sm" />
                      </>
                    ) : 'Grouping purchases on this device…'
                  ) : aiError ? 'Local AI couldn’t finish. You can retry or edit categories below.'
                    : availability === 'unavailable' ? 'Local AI is unavailable on this device. You can edit categories below.'
                    : `${uncategorized?.count} ${uncategorized?.count === 1 ? 'purchase needs' : 'purchases need'} a category.`}
                </div>
                {aiSupported && (merchants.size > 0 || running) && (
                  <Button variant="outline" onClick={() => { void improveCategories() }} disabled={running}>
                    <Sparkles aria-hidden="true" /> Improve categories
                  </Button>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <Transactions
        key={`${month}:${filter}`}
        transactions={transactions}
        category={filter}
        onClear={() => setFilter(null)}
        onEdit={(id, category) => setEdits((previous) => new Map(previous).set(id, category))}
      />
    </div>
  )
}

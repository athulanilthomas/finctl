import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, CircleAlert, CreditCard, Receipt, Sparkles } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Transactions } from '@/components/transactions'
import { categoryLabels } from '@/lib/categories'
import type { Category } from '@/lib/categories'
import { groupMerchants, localAiAvailability } from '@/lib/local-ai'
import { formatAmount, formatMonth, formatRange, monthsIn, summarize } from '@/lib/report'
import type { Statement } from '@/lib/statement'

const CategoryChart = lazy(() => import('@/components/category-chart'))
const chartColors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

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
  const colors = ranked.map(({ category }, index) => category === 'uncategorized' ? 'var(--input)' : chartColors[index % chartColors.length])
  const largestShare = largest ? Math.round(100 * largest.amount / totals.purchase) : 0
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
    <div className="grid min-w-0 gap-4 sm:gap-6">
      <section className="grid gap-4 sm:flex sm:flex-wrap sm:items-end sm:justify-between" aria-labelledby="report-title">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <CreditCard className="size-4 text-primary" aria-hidden="true" /> HDFC credit card
          </p>
          <h1 id="report-title" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Monthly spending
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Transactions from {formatRange(transactions[transactions.length - 1].date, transactions[0].date)}, {month.slice(0, 4)}
          </p>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex">
          <Select value={month} onValueChange={(value) => {
            setMonth(value)
            setFilter(null)
          }}>
            <SelectTrigger aria-label="Report month" className="min-h-11 w-full min-w-0 bg-card sm:w-auto">
              <CalendarDays aria-hidden="true" />
              <SelectValue>{formatMonth(month)}</SelectValue>
            </SelectTrigger>
            <SelectContent position="popper">
              {months.map((value) => (
                <SelectItem key={value} value={value} className="min-h-11 md:min-h-0">{formatMonth(value)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" className="min-h-11" onClick={onClear}>Clear report</Button>
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

      <div className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="justify-between [--card-spacing:--spacing(4)] sm:[--card-spacing:--spacing(6)]">
          <CardHeader className="items-center">
            <CardTitle>
              <h2>{largest && uncategorized && uncategorized.amount >= largest.amount ? 'Largest identified category' : 'Largest spending category'}</h2>
            </CardTitle>
            <CardAction className="grid size-8 place-items-center rounded-md bg-accent text-primary">
              <Receipt className="size-4" aria-hidden="true" />
            </CardAction>
          </CardHeader>
          <CardContent>
            {largest ? (
              <>
                <div>
                  <p className="text-base font-medium">{categoryLabels[largest.category]}</p>
                  <p className="mt-1 text-3xl font-semibold wrap-anywhere tracking-tight text-primary tabular-nums sm:text-4xl">
                    {formatAmount(largest.amount)}
                  </p>
                </div>
                <Progress value={largestShare} aria-label="Share of purchases" />
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span>{largestShare}% of purchases</span>
                  {uncategorized && <span>{formatAmount(uncategorized.amount)} uncategorized</span>}
                </div>
              </>
            ) : (
              <p className="text-base text-muted-foreground">
                {uncategorized ? 'Categorize a purchase to see your largest category.' : 'No purchases this month.'}
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="[--card-spacing:--spacing(4)] sm:[--card-spacing:--spacing(6)]">
          <CardHeader>
            <CardTitle><h2>Card activity</h2></CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-x-6">
              {activity.map(({ label, amount, note }) => (
                <div key={label} className="min-w-0 border-t pt-3">
                  <dt className="text-sm font-medium">{label}</dt>
                  <dd className="mt-1 text-lg font-semibold wrap-anywhere tracking-tight tabular-nums sm:text-xl">{formatAmount(amount)}</dd>
                  <dd className="mt-1 hidden text-sm text-muted-foreground sm:block">{note}</dd>
                </div>
              ))}
            </dl>
            {(totals.fee > 0 || totals.cash > 0) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-sm text-muted-foreground">
                {totals.fee > 0 && <span>Fees & interest {formatAmount(totals.fee)}</span>}
                {totals.cash > 0 && <span>Cash advances {formatAmount(totals.cash)}</span>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {ranked.length > 0 && (
        <Card className="min-w-0 [--card-spacing:--spacing(4)] sm:[--card-spacing:--spacing(6)]">
          <CardHeader>
            <CardTitle><h2>Spending by category</h2></CardTitle>
            <CardDescription>Select a category to see its purchases.</CardDescription>
          </CardHeader>
          <CardContent className="grid items-center gap-4 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:gap-8">
            <Suspense fallback={<div className="mx-auto aspect-square w-full max-w-56" aria-hidden="true" />}>
              <CategoryChart groups={ranked} colors={colors} total={totals.purchase} />
            </Suspense>
            <ul className="min-w-0 divide-y">
              {ranked.map(({ category, count, amount }, index) => (
                <li key={category}>
                  <Button
                    variant={filter === category ? 'secondary' : 'ghost'}
                    className="h-auto min-h-11 w-full justify-start gap-2 px-2 py-2.5 text-left whitespace-normal sm:gap-3"
                    aria-pressed={filter === category}
                    onClick={() => {
                      setFilter(filter === category ? null : category)
                      document.getElementById('transactions')?.scrollIntoView({ block: 'start' })
                    }}
                  >
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: colors[index] }} aria-hidden="true" />
                    <span className="min-w-0 flex-1 wrap-anywhere">
                      {categoryLabels[category]}
                      <span className="block text-xs font-normal text-muted-foreground sm:text-sm">{count} {count === 1 ? 'purchase' : 'purchases'}</span>
                    </span>
                    <span className="max-w-[46%] text-right wrap-anywhere tabular-nums">{formatAmount(amount)}</span>
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
          {(uncategorized || running || aiError) && (
            <CardContent>
              <Alert role="status" className="flex flex-col gap-3 bg-muted/50 sm:flex-row sm:items-center sm:justify-between">
                <AlertDescription className="min-w-0 flex-1">
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
                </AlertDescription>
                {aiSupported && (merchants.size > 0 || running) && (
                  <Button variant="outline" className="min-h-11" onClick={() => { void improveCategories() }} disabled={running}>
                    <Sparkles aria-hidden="true" /> Improve categories
                  </Button>
                )}
              </Alert>
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

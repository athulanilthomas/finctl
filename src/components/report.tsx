import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChartPie, CircleAlert, CreditCard, LayoutDashboard, List, ScanLine } from 'lucide-react'
import { CategoryGrouping } from '@/components/category-grouping'
import { ReportOverview } from '@/components/report-overview'
import { Transactions } from '@/components/transactions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { categoryLabels } from '@/lib/categories'
import type { Category } from '@/lib/categories'
import { geminiMerchantNames } from '@/lib/gemini'
import { groupMerchants, localAiAvailability } from '@/lib/local-ai'
import { allMonths, formatAmount, formatMonth, formatRange, monthsIn, summarize, transactionsForPeriod } from '@/lib/report'
import type { Statement } from '@/lib/statement'

const CategoryChart = lazy(() => import('@/components/category-chart'))
const chartColors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']
const reportTabs = [
  { value: 'overview', label: 'Overview', icon: LayoutDashboard },
  { value: 'categories', label: 'Categories', icon: ChartPie },
  { value: 'transactions', label: 'Transactions', icon: List },
] as const
const panelClass = 'panel-enter min-w-0'

export default function Report({ statement, onClear }: { statement: Statement; onClear: () => void }) {
  const months = useMemo(() => monthsIn(statement.transactions), [statement])
  const [period, setPeriod] = useState(months[0])
  const wholeStatement = period === allMonths
  const [tab, setTab] = useState('overview')
  const [filter, setFilter] = useState<Category | null>(null)
  const [edits, setEdits] = useState(() => new Map<number, Category>())
  const [modelLabels, setModelLabels] = useState(() => new Map<string, Category>())
  const [geminiLabels, setGeminiLabels] = useState(() => new Map<string, Category>())
  const [availability, setAvailability] = useState<Availability | null>(null)
  const [running, setRunning] = useState(false)
  const [download, setDownload] = useState<number | null>(null)
  const [aiError, setAiError] = useState(false)
  const aiRun = useRef<AbortController | null>(null)
  const tabs = useRef<HTMLDivElement>(null)
  const merchantNames = useMemo(() => geminiMerchantNames(statement.transactions), [statement])

  useEffect(() => {
    let cancelled = false
    void localAiAvailability().then((status) => { if (!cancelled) setAvailability(status) })
    return () => {
      cancelled = true
      aiRun.current?.abort()
    }
  }, [])

  const { transactions, cloudNames, merchants } = useMemo(() => {
    const cloudNames = new Map<string, number>()
    const merchants = new Set<string>()
    const transactions = transactionsForPeriod(statement.transactions, period).map((transaction) => {
      if (transaction.kind !== 'purchase') return transaction
      const edit = edits.get(transaction.id)
      if (edit) return { ...transaction, category: edit }
      if (transaction.category !== 'uncategorized') return transaction

      const local = modelLabels.get(transaction.merchant)
      if (local && local !== 'uncategorized') return { ...transaction, category: local }

      const name = merchantNames.get(transaction.id)
      if (name) {
        cloudNames.set(name, (cloudNames.get(name) ?? 0) + 1)
        const label = geminiLabels.get(name)
        if (label && label !== 'uncategorized') return { ...transaction, category: label }
      }
      if (transaction.merchant.length >= 3 && !local) merchants.add(transaction.merchant)
      return transaction
    })
    return { transactions, cloudNames, merchants }
  }, [statement, period, edits, modelLabels, geminiLabels, merchantNames])

  const summary = useMemo(() => summarize(transactions), [transactions])
  const { totals, ranked, uncategorized } = summary
  const { scan, unreadRows, totalDifferences } = statement
  const needsReview = unreadRows > 0 || totalDifferences.length > 0 || Boolean(scan?.reviewPages.length)
  const colors = ranked.map(({ category }, index) => category === 'uncategorized' ? 'var(--muted-foreground)' : chartColors[index % chartColors.length])
  function changeTab(value: string) {
    setTab(value)
    const navigation = tabs.current
    if (!navigation) return

    if (navigation.getBoundingClientRect().top < 0) navigation.scrollIntoView({ block: 'start' })
    navigation.querySelector<HTMLButtonElement>(`[data-report-tab="${value}"]`)?.focus({ preventScroll: true })
  }

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

  return (
    <div className="app-screen grid min-w-0 gap-5 sm:gap-7">
      <section className="grid gap-4 sm:flex sm:flex-wrap sm:items-end sm:justify-between sm:gap-5" aria-labelledby="report-title">
        <div className="min-w-0 space-y-2.5">
          <Badge variant="outline" className="h-7 gap-1.5 px-2.5 text-sm text-muted-foreground">
            <CreditCard aria-hidden="true" /> HDFC credit card
          </Badge>
          <h1 id="report-title" tabIndex={-1} className="text-[clamp(2rem,5.5vw,3.75rem)] leading-[1.04] font-semibold tracking-[-0.06em] outline-none">
            {wholeStatement ? 'Statement spending' : 'Monthly spending'}
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Transactions from {formatRange(transactions[transactions.length - 1].date, transactions[0].date)}
          </p>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex">
          <Select value={period} onValueChange={(value) => {
            setPeriod(value)
            setFilter(null)
          }}>
            <SelectTrigger aria-label="Report period" className="min-h-11 w-full min-w-0 bg-card sm:w-auto">
              <CalendarDays aria-hidden="true" />
              <SelectValue>{wholeStatement ? 'All months' : formatMonth(period)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={allMonths} className="min-h-11 md:min-h-0">All months</SelectItem>
              {months.map((value) => (
                <SelectItem key={value} value={value} className="min-h-11 md:min-h-0">{formatMonth(value)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" className="min-h-11" onClick={onClear}>Clear report</Button>
        </div>
      </section>

      {(scan || needsReview) && (
        <Alert variant={needsReview ? 'destructive' : 'default'}>
          {needsReview ? <CircleAlert aria-hidden="true" /> : <ScanLine aria-hidden="true" />}
          <AlertTitle>{needsReview ? 'Check this statement' : scan?.readAll ? 'Read with OCRia' : 'Scanned on this device'}</AlertTitle>
          <AlertDescription className="col-start-2 grid min-w-0 gap-1.5">
            {scan && (
              <p className="text-muted-foreground">
                {scan.readAll ? 'LiteParse' : 'OCRia Nano'} read {scan.pages} {scan.pages === 1 ? 'page' : 'pages'}.
                {scan.reviewPages.length > 0 && ` Check unclear text on ${scan.reviewPages.length === 1 ? 'page' : 'pages'} ${scan.reviewPages.join(', ')}.`}
              </p>
            )}
            {unreadRows > 0 && (
              <div className="text-muted-foreground">
                {unreadRows} transaction {unreadRows === 1 ? 'row could' : 'rows could'} not be read.
              </div>
            )}
            {totalDifferences.length > 0 && (
              <dl className="grid gap-x-6 gap-y-1.5 sm:flex sm:flex-wrap">
                {totalDifferences.map(({ kind, read, printed }) => (
                  <div key={kind}>
                    <dt className="font-medium text-foreground">{kind === 'charges' ? 'Charges' : 'Payments and credits'}</dt>
                    <dd className="text-muted-foreground tabular-nums">{formatAmount(read)} read · {formatAmount(printed)} on the PDF</dd>
                  </div>
                ))}
              </dl>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Tabs ref={tabs} value={tab} onValueChange={changeTab} activationMode="manual" className="min-w-0 gap-4 sm:gap-6">
        <div className="sticky top-0 z-10 border-b bg-background">
          <TabsList variant="line" className="w-full justify-start gap-0 p-0 group-data-horizontal/tabs:h-12 sm:w-auto sm:gap-1" aria-label="Spending report sections">
            {reportTabs.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                data-report-tab={value}
                className="min-h-11 px-1 group-data-horizontal/tabs:after:-bottom-px motion-reduce:transition-none motion-reduce:after:transition-none sm:px-4"
              >
                <Icon className="hidden sm:inline-block" aria-hidden="true" /> {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview" className={panelClass}>
          <ReportOverview summary={summary} onViewCategories={() => changeTab('categories')} />
        </TabsContent>

        <TabsContent value="categories" className={`${panelClass} space-y-4`}>
          <CategoryGrouping
            names={cloudNames}
            labels={geminiLabels}
            uncategorized={uncategorized?.count ?? 0}
            browser={{ availability, hasMerchants: merchants.size > 0, running, download, failed: aiError }}
            onBrowser={() => { void improveCategories() }}
            onGeminiBatch={(batch) => setGeminiLabels((previous) => new Map([...previous, ...batch]))}
          />
          {ranked.length > 0 ? (
            <Card className="min-w-0 [--card-spacing:--spacing(4)] sm:[--card-spacing:--spacing(6)]">
              <CardHeader>
                <CardTitle><h2>Spending by category</h2></CardTitle>
                <CardDescription>Select a category to see its purchases.</CardDescription>
              </CardHeader>
              <CardContent className="grid items-center gap-4 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:gap-8">
                <Suspense fallback={<Skeleton className="mx-auto aspect-square w-full max-w-56 rounded-full motion-reduce:animate-none" aria-hidden="true" />}>
                  <CategoryChart groups={ranked} colors={colors} total={totals.purchase} />
                </Suspense>
                <ul className="min-w-0 divide-y">
                  {ranked.map(({ category, count, amount }, index) => (
                    <li key={category}>
                      <Button
                        variant={filter === category ? 'secondary' : 'ghost'}
                        className="h-auto min-h-11 w-full justify-start gap-2 px-2 py-2.5 text-left whitespace-normal sm:gap-3"
                        onClick={() => {
                          setFilter(category)
                          changeTab('transactions')
                        }}
                      >
                        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: colors[index] }} aria-hidden="true" />
                        <span className="min-w-0 flex-1 wrap-anywhere">
                          {categoryLabels[category]}
                          <span className="block text-xs font-normal text-muted-foreground sm:text-sm">{count} {count === 1 ? 'purchase' : 'purchases'}</span>
                        </span>
                        <span className="max-w-[46%] text-right font-mono wrap-anywhere tabular-nums">{formatAmount(amount)}</span>
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : (
            <Empty className="border border-solid bg-card px-4 py-8">
              <EmptyHeader>
                <EmptyMedia variant="icon"><ChartPie aria-hidden="true" /></EmptyMedia>
                <EmptyTitle><h2>No purchases</h2></EmptyTitle>
                <EmptyDescription>Find payments, credits, and other card activity in Transactions.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" className="min-h-11" onClick={() => changeTab('transactions')}>View transactions</Button>
              </EmptyContent>
            </Empty>
          )}
        </TabsContent>

        <TabsContent value="transactions" className={panelClass}>
          <Transactions
            key={`${period}:${filter}`}
            transactions={transactions}
            category={filter}
            onClear={() => setFilter(null)}
            onEdit={(ids, category) => setEdits((previous) => {
              const updated = new Map(previous)
              for (const id of ids) updated.set(id, category)
              return updated
            })}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

import { Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { categoryLabels } from '@/lib/categories'
import { formatAmount } from '@/lib/report'
import type { summarize } from '@/lib/report'

export function ReportOverview({ summary, onViewCategories }: {
  summary: ReturnType<typeof summarize>
  onViewCategories: () => void
}) {
  const { totals, totalCharges, largest, uncategorized } = summary
  const share = largest ? Math.round(100 * largest.amount / totals.purchase) : 0
  const activity = [
    { label: 'Total charges', amount: totalCharges, note: 'Includes fees and cash advances' },
    { label: 'Purchases', amount: totals.purchase, note: 'Before refunds and credits' },
    { label: 'Card payments', amount: totals.payment, note: 'Repayments to your card' },
    { label: 'Refunds & other credits', amount: totals.credit, note: 'Credits applied to your card' },
  ]

  return (
    <div className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
      <Card className="relative isolate [--card-spacing:--spacing(4)] sm:[--card-spacing:--spacing(6)]">
        <div aria-hidden="true" className="spending-grid pointer-events-none absolute inset-y-0 right-0 -z-10 w-3/5 opacity-70" />
        <CardHeader className="items-center">
          <CardTitle>
            <h2>{largest && uncategorized && uncategorized.amount >= largest.amount ? 'Largest identified category' : 'Largest spending category'}</h2>
          </CardTitle>
          <CardAction className="grid size-8 place-items-center rounded-md bg-muted text-foreground">
            <Receipt className="size-4" aria-hidden="true" />
          </CardAction>
        </CardHeader>
        <CardContent className="flex-1 justify-center gap-4">
          {largest ? (
            <>
              <div className="space-y-1">
                <p className="text-base font-medium text-muted-foreground">{categoryLabels[largest.category]}</p>
                <p className="text-[clamp(2rem,5vw,3.5rem)] leading-tight font-semibold wrap-anywhere tracking-[-0.055em] tabular-nums">
                  {formatAmount(largest.amount)}
                </p>
              </div>
              <div className="grid gap-2">
                <Progress
                  value={share}
                  aria-label="Share of purchases"
                  className="[&_[data-slot=progress-indicator]]:bg-(--chart-2)"
                />
                <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span>{share}% of purchases</span>
                  {uncategorized && <span>{formatAmount(uncategorized.amount)} uncategorized</span>}
                </div>
              </div>
            </>
          ) : (
            <p className="text-base text-muted-foreground">
              {uncategorized ? 'Categorize a purchase to see your largest category.' : 'No purchases in this period.'}
            </p>
          )}
        </CardContent>
        {totals.purchase > 0 && (
          <CardFooter>
            <Button variant="outline" className="min-h-11" onClick={onViewCategories}>View categories</Button>
          </CardFooter>
        )}
      </Card>

      <Card className="[--card-spacing:--spacing(4)] sm:[--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle><h2>Card activity</h2></CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 overflow-hidden rounded-lg border">
            {activity.map(({ label, amount, note }) => (
              <div key={label} className="min-w-0 bg-muted/20 p-2.5 odd:border-r nth-[n+3]:border-t sm:p-3.5">
                <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
                <dd className="mt-1 text-lg font-semibold wrap-anywhere tracking-tight tabular-nums sm:text-2xl">{formatAmount(amount)}</dd>
                <dd className="mt-1 hidden text-sm text-muted-foreground sm:block">{note}</dd>
              </div>
            ))}
          </dl>
          {(totals.fee > 0 || totals.cash > 0) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {totals.fee > 0 && <span>Fees & interest {formatAmount(totals.fee)}</span>}
              {totals.cash > 0 && <span>Cash advances {formatAmount(totals.cash)}</span>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

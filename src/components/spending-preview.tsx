import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { categoryLabels } from '@/lib/categories'
import { formatAmount } from '@/lib/report'

const purchases = [
  { category: 'shopping', amount: 1_245_000 },
  { category: 'dining', amount: 820_000 },
  { category: 'transport', amount: 365_000 },
  { category: 'groceries', amount: 210_000 },
] as const

const total = purchases.reduce((sum, { amount }) => sum + amount, 0)

export function SpendingPreview() {
  return (
    <aside aria-labelledby="spending-preview-title" className="relative isolate min-w-0 overflow-hidden rounded-2xl border bg-muted/25 p-3 sm:p-6 lg:p-7">
      <div aria-hidden="true" className="spending-preview-grid pointer-events-none absolute inset-0 -z-10" />
      <Card className="mx-auto w-full max-w-md border shadow-lg ring-0 [--card-spacing:--spacing(4)] sm:[--card-spacing:--spacing(6)]">
        <CardHeader className="border-b">
          <CardTitle className="text-lg">
            <h2 id="spending-preview-title">Monthly spending</h2>
          </CardTitle>
          <CardDescription>November</CardDescription>
          <CardAction>
            <Badge variant="secondary">Sample data</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="gap-5 sm:gap-6">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total purchases</p>
            <p className="text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">{formatAmount(total)}</p>
          </div>
          <ul className="grid gap-3 sm:gap-4">
            {purchases.map(({ category, amount }, index) => (
              <li key={category} className="grid gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 font-medium">{categoryLabels[category]}</span>
                  <span className="shrink-0 font-mono text-muted-foreground tabular-nums">{formatAmount(amount)}</span>
                </div>
                <Progress
                  value={Math.round(100 * amount / total)}
                  aria-label={`${categoryLabels[category]} share of purchases`}
                  className={index === 0
                    ? '[&_[data-slot=progress-indicator]]:bg-(--chart-2)'
                    : '[&_[data-slot=progress-indicator]]:bg-(--chart-1)'}
                />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </aside>
  )
}

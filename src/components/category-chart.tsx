import { Pie, PieChart } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import { categoryLabels } from '@/lib/categories'
import { formatAmount } from '@/lib/report'
import type { CategoryTotal } from '@/lib/report'

const config = { amount: { label: 'Purchases' } } satisfies ChartConfig

export default function CategoryChart({ groups, colors, total }: {
  groups: CategoryTotal[]
  colors: string[]
  total: number
}) {
  const data = groups.map((group, index) => ({
    ...group,
    label: categoryLabels[group.category],
    fill: colors[index],
  }))

  return (
    <div className="relative mx-auto aspect-square w-full max-w-56" aria-hidden="true">
      <ChartContainer config={config} className="absolute inset-0 size-full" initialDimension={{ width: 224, height: 224 }}>
        <PieChart accessibilityLayer={false}>
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel formatter={(value, _name, item) => (
              <span>{item.payload.label} · {formatAmount(Number(value))}</span>
            )} />}
          />
          <Pie
            data={data}
            dataKey="amount"
            nameKey="label"
            innerRadius="74%"
            outerRadius="97%"
            paddingAngle={groups.length > 1 ? 2 : 0}
            strokeWidth={0}
            isAnimationActive={false}
          />
        </PieChart>
      </ChartContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-sm text-muted-foreground">Purchases</span>
        <span className="mt-1 max-w-[68%] text-lg font-semibold wrap-anywhere tracking-tight tabular-nums">{formatAmount(total)}</span>
      </div>
    </div>
  )
}

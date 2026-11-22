import { Label, Pie, PieChart } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import { categoryLabels } from '@/lib/categories'
import { formatAmount } from '@/lib/report'
import type { CategoryTotal } from '@/lib/report'

export default function CategoryChart({ groups, colors, total }: {
  groups: CategoryTotal[]
  colors: string[]
  total: number
}) {
  const config = Object.fromEntries(groups.map(({ category }, index) => [category, {
    label: categoryLabels[category],
    color: colors[index],
  }])) satisfies ChartConfig
  const data = groups.map((group) => ({ ...group, fill: `var(--color-${group.category})` }))
  const totalLabel = formatAmount(total)

  return (
    <ChartContainer
      config={config}
      className="mx-auto aspect-square w-full max-w-56"
      initialDimension={{ width: 224, height: 224 }}
      aria-hidden="true"
    >
      <PieChart accessibilityLayer={false}>
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel nameKey="category" valueFormatter={(value) => formatAmount(Number(value))} />}
        />
        <Pie
          data={data}
          dataKey="amount"
          nameKey="category"
          innerRadius="70%"
          outerRadius="97%"
          paddingAngle={groups.length > 1 ? 2 : 0}
          strokeWidth={0}
          isAnimationActive="auto"
          animationDuration={350}
        >
          <Label content={({ viewBox }) => {
            if (!viewBox || !('cx' in viewBox) || !('cy' in viewBox)) return null

            const { cx, cy, innerRadius } = viewBox
            return (
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                <tspan
                  x={cx}
                  y={cy - 8}
                  className="fill-foreground font-mono text-base font-semibold"
                  textLength={totalLabel.length > 14 ? innerRadius * 1.7 : undefined}
                  lengthAdjust="spacingAndGlyphs"
                >
                  {totalLabel}
                </tspan>
                <tspan x={cx} y={cy + 13} className="fill-muted-foreground text-sm">
                  Purchases
                </tspan>
              </text>
            )
          }} />
        </Pie>
      </PieChart>
    </ChartContainer>
  )
}

import { ArrowUpRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { geminiModels, isGeminiModel } from '@/lib/gemini-models'
import type { GeminiModel } from '@/lib/gemini-models'

const modelIds = Object.keys(geminiModels).filter(isGeminiModel)
const costColors = {
  'Low cost': 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  'Medium cost': 'border-(--chart-2)/25 bg-(--chart-2)/10 text-blue-700 dark:text-blue-300',
  'High cost': 'border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-300',
}

function CostBadge({ cost }: { cost: keyof typeof costColors }) {
  return <Badge variant="outline" className={`ml-auto ${costColors[cost]}`}>{cost}</Badge>
}

export function GeminiModelPicker({ model, onChange }: { model: GeminiModel; onChange: (model: GeminiModel) => void }) {
  const selected = geminiModels[model]

  return (
    <div className="grid min-w-0 gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="gemini-model">Gemini model</Label>
        <a href="https://aistudio.google.com/docs/pricing" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Google pricing <ArrowUpRight className="size-3" aria-hidden="true" />
        </a>
      </div>
      <Select value={model} onValueChange={(value) => { if (isGeminiModel(value)) onChange(value) }}>
        <SelectTrigger id="gemini-model" aria-describedby="gemini-model-price" className="min-h-11 w-full min-w-0 gap-2 px-3 *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:flex-1">
          <SelectValue>
            <span className="truncate">{selected.name}</span>
            <CostBadge cost={selected.cost} />
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="start" className="w-(--radix-select-trigger-width)">
          <SelectGroup>
            <SelectLabel>Paid rates in USD per 1M tokens</SelectLabel>
            {modelIds.map((id) => {
              const { name, rates, cost, paidOnly } = geminiModels[id]
              return (
                <SelectItem key={id} value={id} textValue={name} className="min-h-12 py-2 *:[span]:last:w-full">
                  <span className="grid min-w-0 gap-0.5 whitespace-normal">
                    <span className="font-medium">{name}</span>
                    <span className="text-xs text-muted-foreground">{rates}{paidOnly && ' · Paid only'}</span>
                  </span>
                  <CostBadge cost={cost} />
                </SelectItem>
              )
            })}
          </SelectGroup>
        </SelectContent>
      </Select>
      <p id="gemini-model-price" className="text-xs text-muted-foreground">
        {selected.rates} per 1M tokens (USD){selected.paidOnly && ' · Paid only'}
      </p>
    </div>
  )
}

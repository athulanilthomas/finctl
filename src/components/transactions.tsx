import { useRef, useState } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { categories, categoryLabels, isCategory } from '@/lib/categories'
import type { Category } from '@/lib/categories'
import { formatAmount, formatDate } from '@/lib/report'
import { transactionLabels } from '@/lib/statement'
import type { Transaction } from '@/lib/statement'

const pageSize = 30
const views = [
  { value: 'all', label: 'All' },
  { value: 'charges', label: 'Charges' },
  { value: 'credits', label: 'Payments & credits' },
] as const
const isCredit = (kind: Transaction['kind']) => kind === 'payment' || kind === 'credit'

export function Transactions({ transactions, category, onClear, onEdit }: {
  transactions: Transaction[]
  category: Category | null
  onClear: () => void
  onEdit: (id: number, category: Category) => void
}) {
  const [view, setView] = useState<typeof views[number]['value']>('all')
  const [limit, setLimit] = useState(pageSize)
  const [editing, setEditing] = useState<Extract<Transaction, { kind: 'purchase' }> | null>(null)
  const editTrigger = useRef<HTMLButtonElement>(null)

  const rows = transactions.filter((transaction) => {
    if (category) return transaction.kind === 'purchase' && transaction.category === category
    if (view === 'charges') return !isCredit(transaction.kind)
    if (view === 'credits') return isCredit(transaction.kind)
    return true
  })

  return (
    <Card id="transactions" className="scroll-mt-5">
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="text-lg">Transactions</CardTitle>
          <CardDescription className="mt-1">
            {rows.length} {rows.length === 1 ? 'transaction' : 'transactions'}{category && ` · ${categoryLabels[category]}`}
          </CardDescription>
        </div>
        {category ? (
          <Button variant="outline" size="sm" onClick={onClear}>Clear category filter</Button>
        ) : (
          <div className="flex flex-wrap gap-0.5 rounded-lg bg-muted p-1" role="group" aria-label="Filter transactions">
            {views.map(({ value, label }) => (
              <Button
                key={value}
                variant={view === value ? 'outline' : 'ghost'}
                size="sm"
                aria-pressed={view === value}
                onClick={() => {
                  setView(value)
                  setLimit(pageSize)
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="px-0" id="transaction-list">
        {rows.length ? (
          <Table>
            <TableHeader className="bg-muted/65">
              <TableRow>
                <TableHead className="pl-6">Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="pr-6 text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, limit).map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="pl-6 text-muted-foreground">{formatDate(transaction.date)}</TableCell>
                  <TableCell className="w-full min-w-44 max-w-md py-3 whitespace-normal wrap-break-word">
                    {transaction.description}
                  </TableCell>
                  <TableCell>
                    {transaction.kind === 'purchase' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-foreground/80"
                        aria-label={`Change category for ${transaction.description}, ${categoryLabels[transaction.category]}`}
                        onClick={(event) => {
                          editTrigger.current = event.currentTarget
                          setEditing(transaction)
                        }}
                      >
                        {categoryLabels[transaction.category]}
                        <Pencil className="opacity-65" aria-hidden="true" />
                      </Button>
                    ) : <span className="px-2 text-sm text-muted-foreground">{transactionLabels[transaction.kind]}</span>}
                  </TableCell>
                  <TableCell className="pr-6 text-right font-medium tabular-nums">
                    {isCredit(transaction.kind) ? <span className="text-primary">+{formatAmount(transaction.amount)}</span> : formatAmount(transaction.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <p className="border-t px-6 pt-5 text-sm text-muted-foreground">No transactions match this filter.</p>}
        {limit < rows.length && (
          <div className="flex justify-center pt-5">
            <Button variant="outline" onClick={() => setLimit(limit + pageSize)}>Show more</Button>
          </div>
        )}
      </CardContent>
      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null) }}>
        {editing && (
          <DialogContent onCloseAutoFocus={(event) => {
            if (!editTrigger.current?.isConnected) return
            event.preventDefault()
            editTrigger.current.focus()
          }}>
            <DialogHeader>
              <DialogTitle>Change purchase category</DialogTitle>
              <DialogDescription className="wrap-break-word">{editing.description}</DialogDescription>
            </DialogHeader>
            <Select value={editing.category} onValueChange={(value) => {
              if (!isCategory(value)) return
              onEdit(editing.id, value)
              setEditing(null)
            }}>
              <SelectTrigger aria-label="Purchase category" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent position="popper">
                {categories.map((value) => <SelectItem key={value} value={value}>{categoryLabels[value]}</SelectItem>)}
              </SelectContent>
            </Select>
          </DialogContent>
        )}
      </Dialog>
    </Card>
  )
}

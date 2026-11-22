import { useRef, useState } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
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
type Purchase = Extract<Transaction, { kind: 'purchase' }>

function TransactionCategory({ transaction, onEdit }: {
  transaction: Transaction
  onEdit: (transaction: Purchase, trigger: HTMLButtonElement) => void
}) {
  if (transaction.kind !== 'purchase') {
    return <span className="text-sm text-muted-foreground">{transactionLabels[transaction.kind]}</span>
  }

  const category = categoryLabels[transaction.category]
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 h-auto min-h-11 max-w-[calc(100%+0.5rem)] justify-start px-2 text-left whitespace-normal text-muted-foreground"
      aria-label={`Change category for ${transaction.description}, ${category}`}
      onClick={(event) => onEdit(transaction, event.currentTarget)}
    >
      <span className="min-w-0 wrap-anywhere">{category}</span>
      <Pencil aria-hidden="true" />
    </Button>
  )
}

export function Transactions({ transactions, category, onClear, onEdit }: {
  transactions: Transaction[]
  category: Category | null
  onClear: () => void
  onEdit: (id: number, category: Category) => void
}) {
  const [view, setView] = useState('all')
  const [limit, setLimit] = useState(pageSize)
  const [editing, setEditing] = useState<Purchase | null>(null)
  const editTrigger = useRef<HTMLButtonElement>(null)

  const rows = transactions.filter((transaction) => {
    if (category) return transaction.kind === 'purchase' && transaction.category === category
    if (view === 'charges') return !isCredit(transaction.kind)
    if (view === 'credits') return isCredit(transaction.kind)
    return true
  })

  function openEditor(transaction: Purchase, trigger: HTMLButtonElement) {
    editTrigger.current = trigger
    setEditing(transaction)
  }

  return (
    <Card id="transactions" className="min-w-0 scroll-mt-5 [--card-spacing:--spacing(4)] sm:[--card-spacing:--spacing(6)]">
      <CardHeader className="gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <CardTitle><h2>Transactions</h2></CardTitle>
          <CardDescription className="mt-1">
            {rows.length} {rows.length === 1 ? 'transaction' : 'transactions'}{category && ` · ${categoryLabels[category]}`}
          </CardDescription>
        </div>
        {category ? (
          <Button variant="outline" className="min-h-11 justify-self-start" onClick={onClear}>Clear category filter</Button>
        ) : (
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={0}
            className="w-full sm:w-auto"
            aria-label="Filter transactions"
            value={view}
            onValueChange={(value) => {
              if (!value) return
              setView(value)
              setLimit(pageSize)
            }}
          >
            {views.map(({ value, label }) => (
              <ToggleGroupItem
                key={value}
                value={value}
                className="h-auto min-h-11 flex-1 py-1 leading-tight whitespace-normal sm:flex-none"
              >
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </CardHeader>
      <CardContent className="px-0" id="transaction-list">
        {rows.length ? (
          <Table className="table-fixed">
            <TableHeader className="border-y bg-muted/55">
              <TableRow>
                <TableHead scope="col" className="hidden w-24 pl-6 md:table-cell">Date</TableHead>
                <TableHead scope="col" className="pl-4 sm:pl-6 md:pl-2">Description</TableHead>
                <TableHead scope="col" className="hidden w-42 md:table-cell lg:w-48">Category</TableHead>
                <TableHead scope="col" className="w-[38%] pr-4 text-right sm:w-36 sm:pr-6">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, limit).map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="hidden pl-6 text-muted-foreground md:table-cell">
                    <time dateTime={transaction.date}>{formatDate(transaction.date)}</time>
                  </TableCell>
                  <TableCell className="py-3 pl-4 align-top whitespace-normal sm:pl-6 md:pl-2 md:align-middle">
                    <p className="wrap-anywhere">{transaction.description}</p>
                    <div className="mt-0.5 md:hidden">
                      <TransactionCategory transaction={transaction} onEdit={openEditor} />
                    </div>
                  </TableCell>
                  <TableCell className="hidden whitespace-normal md:table-cell">
                    <TransactionCategory transaction={transaction} onEdit={openEditor} />
                  </TableCell>
                  <TableCell className="py-3 pr-4 text-right align-top font-medium whitespace-normal wrap-anywhere tabular-nums sm:pr-6 md:align-middle">
                    {isCredit(transaction.kind) ? <span className="text-primary">+{formatAmount(transaction.amount)}</span> : formatAmount(transaction.amount)}
                    <time dateTime={transaction.date} className="mt-1 block text-xs font-normal text-muted-foreground md:hidden">
                      {formatDate(transaction.date)}
                    </time>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <p className="border-t px-6 pt-5 text-sm text-muted-foreground">No transactions match this filter.</p>}
        {limit < rows.length && (
          <div className="flex justify-center pt-5">
            <Button variant="outline" className="min-h-11" onClick={() => setLimit(limit + pageSize)}>Show more</Button>
          </div>
        )}
      </CardContent>
      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null) }}>
        {editing && (
          <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:p-6" onCloseAutoFocus={(event) => {
            if (!editTrigger.current?.isConnected) return
            event.preventDefault()
            editTrigger.current.focus()
          }}>
            <DialogHeader className="pr-7">
              <DialogTitle>Change purchase category</DialogTitle>
              <DialogDescription className="wrap-anywhere">{editing.description}</DialogDescription>
            </DialogHeader>
            <Select value={editing.category} onValueChange={(value) => {
              if (!isCategory(value)) return
              onEdit(editing.id, value)
              setEditing(null)
            }}>
              <SelectTrigger aria-label="Purchase category" className="min-h-11 w-full min-w-0"><SelectValue /></SelectTrigger>
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

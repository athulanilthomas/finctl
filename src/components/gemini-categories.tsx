import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, ArrowRight, KeyRound } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { DialogClose, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import type { Category } from '@/lib/categories'
import { classifyWithGemini, geminiBatchSize } from '@/lib/gemini'

export function GeminiCategories({ names, labels, onBatch, onBack, onComplete }: {
  names: string[]
  labels: Map<string, Category>
  onBatch: (batch: Map<string, Category>) => void
  onBack: () => void
  onComplete: () => void
}) {
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const keyInput = useRef<HTMLInputElement>(null)
  const run = useRef<AbortController | null>(null)
  const remaining = names.filter((name) => !labels.has(name))
  const completed = names.length - remaining.length

  useEffect(() => () => { run.current?.abort() }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const key = keyInput.current?.value.trim()
    if (!key || !remaining.length || run.current) return
    event.currentTarget.reset()

    const controller = new AbortController()
    run.current = controller
    setWorking(true)
    setError('')
    try {
      for (let i = 0; i < remaining.length; i += geminiBatchSize) {
        const names = remaining.slice(i, i + geminiBatchSize)
        const categories = await classifyWithGemini(names, key, controller.signal)
        if (controller.signal.aborted) return
        onBatch(new Map(names.map((name, index) => [name, categories[index]])))
      }
      onComplete()
    } catch (error) {
      if (!controller.signal.aborted) {
        setError(error instanceof Error ? error.message : 'Gemini couldn’t finish this batch. Try again.')
      }
    } finally {
      if (run.current === controller) {
        run.current = null
        setWorking(false)
      }
    }
  }

  return (
    <form onSubmit={submit} autoComplete="off" className="grid min-w-0 gap-5">
      {working ? (
        <div className="grid gap-2 rounded-lg border bg-muted/30 p-3" role="status">
          <p className="font-medium tabular-nums">{completed} of {names.length} merchants reviewed</p>
          <Progress value={100 * completed / names.length} aria-label="Merchants reviewed" />
        </div>
      ) : (
        <>
          <div className="min-w-0 overflow-hidden rounded-lg border bg-muted/20">
            <p id="gemini-names" className="border-b bg-muted/40 px-3 py-2 font-medium">Merchant names to send ({remaining.length})</p>
            <ul tabIndex={0} aria-labelledby="gemini-names" className="max-h-32 divide-y overflow-auto px-3 text-muted-foreground">
              {remaining.map((name) => <li key={name} className="py-1.5 wrap-anywhere">{name}</li>)}
            </ul>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="gemini-key"><KeyRound className="size-3.5" aria-hidden="true" /> Gemini API key</Label>
            <Input ref={keyInput} id="gemini-key" type="password" autoComplete="off" required className="min-h-11 text-base sm:text-sm" />
            <a href="https://aistudio.google.com/docs/terms#unpaid-services" target="_blank" rel="noreferrer" className="w-fit text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
              Google’s Gemini API data terms
            </a>
          </div>
        </>
      )}
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <DialogFooter className="sm:justify-between">
        {working ? (
          <DialogClose asChild><Button type="button" variant="outline" className="min-h-11">Cancel</Button></DialogClose>
        ) : (
          <>
            <Button type="button" variant="ghost" className="min-h-11" onClick={onBack}><ArrowLeft aria-hidden="true" /> Back</Button>
            <Button type="submit" className="min-h-11" disabled={!remaining.length}>Send names to Gemini <ArrowRight aria-hidden="true" /></Button>
          </>
        )}
      </DialogFooter>
    </form>
  )
}

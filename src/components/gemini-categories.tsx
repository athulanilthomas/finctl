import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, ArrowRight, KeyRound } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DialogClose, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import type { Category } from '@/lib/categories'
import { classifyWithGemini, geminiBatchSize } from '@/lib/gemini'

export function GeminiCategories({ names, labels, savedKey, onSavedKeyChange, onBatch, onBack, onComplete }: {
  names: string[]
  labels: Map<string, Category>
  savedKey: string | null
  onSavedKeyChange: (key: string | null) => boolean
  onBatch: (batch: Map<string, Category>) => void
  onBack: () => void
  onComplete: () => void
}) {
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const keyInput = useRef<HTMLInputElement>(null)
  const backButton = useRef<HTMLButtonElement>(null)
  const focusAfterForget = useRef(false)
  const run = useRef<AbortController | null>(null)
  const remaining = names.filter((name) => !labels.has(name))
  const completed = names.length - remaining.length

  useEffect(() => () => { run.current?.abort() }, [])

  useEffect(() => {
    if (savedKey !== null || !focusAfterForget.current) return
    focusAfterForget.current = false
    const target = keyInput.current ?? backButton.current
    target?.focus()
  }, [savedKey])

  function forgetKey() {
    if (!onSavedKeyChange(null)) {
      setError('Your browser blocked access to the saved key. Try again.')
      return
    }
    focusAfterForget.current = true
    setError('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const key = savedKey ?? keyInput.current?.value.trim()
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
        if (i === 0 && savedKey === null) onSavedKeyChange(key)
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
    <form onSubmit={submit} autoComplete="off" className="grid min-w-0 gap-3 sm:gap-5">
      {working ? (
        <div className="grid gap-2 rounded-lg border bg-muted/30 p-3" role="status">
          <p className="font-medium tabular-nums">{completed} of {names.length} merchants reviewed</p>
          <Progress value={100 * completed / names.length} aria-label="Merchants reviewed" />
        </div>
      ) : (
        <>
          {remaining.length > 0 && (
            <div className="min-w-0 overflow-hidden rounded-lg border bg-muted/20">
              <p id="gemini-names" className="border-b bg-muted/40 px-3 py-2 font-medium">Merchant names to send ({remaining.length})</p>
              <ul tabIndex={0} aria-labelledby="gemini-names" className="max-h-32 divide-y overflow-auto px-3 text-muted-foreground">
                {remaining.map((name) => <li key={name} className="py-1.5 wrap-anywhere">{name}</li>)}
              </ul>
            </div>
          )}
          <div className="grid min-w-0 gap-2">
            {savedKey ? (
              <Card size="sm" className="flex-row items-center gap-2.5 rounded-lg bg-muted/20 px-3 py-2 shadow-none">
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-(--chart-2)/10 text-blue-700 ring-1 ring-inset ring-(--chart-2)/25 dark:text-blue-300">
                  <KeyRound className="size-4" aria-hidden="true" />
                </span>
                <p className="min-w-0 flex-1 font-medium">Key saved for this tab</p>
                <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={forgetKey}>Forget key</Button>
              </Card>
            ) : remaining.length > 0 ? (
              <>
                <Label htmlFor="gemini-key"><KeyRound className="size-3.5" aria-hidden="true" /> Gemini API key</Label>
                <Input ref={keyInput} id="gemini-key" type="password" autoComplete="off" aria-describedby="gemini-key-hint" required className="min-h-11 text-base sm:text-sm" />
                <p id="gemini-key-hint" className="text-xs text-muted-foreground">Saved for this tab after a successful request.</p>
              </>
            ) : <p role="status" className="text-muted-foreground">Key removed from this tab.</p>}
            {remaining.length > 0 && (
              <a href="https://aistudio.google.com/docs/terms#unpaid-services" target="_blank" rel="noreferrer" className="w-fit text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
                Google’s Gemini API data terms
              </a>
            )}
          </div>
        </>
      )}
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <DialogFooter className="flex-row flex-wrap justify-between sm:justify-between">
        {working ? (
          <DialogClose asChild><Button type="button" variant="outline" className="min-h-11">Cancel</Button></DialogClose>
        ) : (
          <>
            <Button ref={backButton} type="button" variant="ghost" className="min-h-11" onClick={onBack}><ArrowLeft aria-hidden="true" /> Back</Button>
            {remaining.length > 0 && <Button type="submit" className="min-h-11">Send names to Gemini <ArrowRight aria-hidden="true" /></Button>}
          </>
        )}
      </DialogFooter>
    </form>
  )
}

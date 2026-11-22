import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Sparkles } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import type { Category } from '@/lib/categories'
import { classifyWithGemini, geminiBatchSize } from '@/lib/gemini'

export function GeminiCategories({ names, labels, disabled, onBatch }: {
  names: string[]
  labels: Map<string, Category>
  disabled: boolean
  onBatch: (batch: Map<string, Category>) => void
}) {
  const [open, setOpen] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const keyInput = useRef<HTMLInputElement>(null)
  const run = useRef<AbortController | null>(null)
  const remaining = names.filter((name) => !labels.has(name))
  const completed = names.length - remaining.length

  useEffect(() => () => { run.current?.abort() }, [])

  function changeOpen(next: boolean) {
    if (!next) {
      run.current?.abort()
      run.current = null
      setWorking(false)
      setError('')
    }
    setOpen(next)
  }

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
      setOpen(false)
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

  if (!names.length) return null

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <Alert className="flex flex-wrap items-center justify-between gap-3 bg-muted/30">
        <AlertDescription role="status">
          {completed === names.length
            ? `Gemini reviewed ${completed} ${completed === 1 ? 'merchant' : 'merchants'} in this statement.`
            : 'Use your Gemini API key to categorize merchants across this statement.'}
        </AlertDescription>
        {remaining.length > 0 && (
          <DialogTrigger asChild>
            <Button variant="outline" className="min-h-11" disabled={disabled}>
              <Sparkles aria-hidden="true" /> Improve with Gemini
            </Button>
          </DialogTrigger>
        )}
      </Alert>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto" showCloseButton={false}>
        <form onSubmit={submit} autoComplete="off" className="grid min-w-0 gap-4">
          <DialogHeader>
            <DialogTitle>Improve with Gemini</DialogTitle>
            <DialogDescription>
              The merchant names shown here go through finctl’s Vercel endpoint to Google. The PDF and transaction details stay in your browser. Your key is used for this run.
            </DialogDescription>
          </DialogHeader>
          {working ? (
            <div className="grid gap-2" role="status">
              <p>{completed} of {names.length} merchants reviewed</p>
              <Progress value={100 * completed / names.length} aria-label="Merchants reviewed" />
            </div>
          ) : (
            <>
              <div className="grid gap-2">
                <p id="gemini-names" className="font-medium">Merchant names to send ({remaining.length})</p>
                <ul tabIndex={0} aria-labelledby="gemini-names" className="max-h-36 overflow-auto rounded-md border bg-muted/30 p-3 text-muted-foreground">
                  {remaining.map((name) => <li key={name} className="py-0.5 wrap-anywhere">{name}</li>)}
                </ul>
                <a href="https://aistudio.google.com/docs/terms#unpaid-services" target="_blank" rel="noreferrer" className="text-muted-foreground underline underline-offset-4">
                  Google’s Gemini API data terms
                </a>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="gemini-key">Gemini API key</Label>
                <Input ref={keyInput} id="gemini-key" type="password" autoComplete="off" required className="min-h-11" />
              </div>
            </>
          )}
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => changeOpen(false)}>Cancel</Button>
            <Button type="submit" className="min-h-11" disabled={working}>Send names to Gemini</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

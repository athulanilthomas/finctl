import { lazy, Suspense, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ChartNoAxesColumnIncreasing, FileText, LoaderCircle, LockKeyhole, Upload } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Statement } from '@/lib/statement'

const loadReport = () => import('@/components/report')
const Report = lazy(loadReport)

export default function App() {
  const filePicker = useRef<HTMLInputElement>(null)
  const activeImport = useRef<AbortController | null>(null)
  const [statement, setStatement] = useState<Statement | null>(null)
  const [filename, setFilename] = useState('')
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [passwordRequest, setPasswordRequest] = useState<{
    submit: (password: string) => void
    incorrect: boolean
  } | null>(null)

  function cancelImport() {
    activeImport.current?.abort()
    activeImport.current = null
    setFilename('')
    setPasswordRequest(null)
  }

  async function openFile(file: File) {
    cancelImport()
    setError('')
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setError('Choose a PDF statement.')
      return
    }

    const controller = new AbortController()
    activeImport.current = controller
    setFilename(file.name)
    try {
      const [report] = await Promise.all([
        import('@/lib/pdf').then(({ readStatement }) => readStatement(file, controller.signal, (submit, incorrect) => {
          if (!controller.signal.aborted) setPasswordRequest({ submit, incorrect })
        })),
        loadReport(),
      ])
      if (!controller.signal.aborted) setStatement(report)
    } catch (error) {
      if (!controller.signal.aborted) {
        setError(error instanceof Error ? error.message : 'This statement could not be read.')
      }
    } finally {
      if (activeImport.current === controller) cancelImport()
    }
  }

  function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const password = new FormData(event.currentTarget).get('password')
    if (typeof password !== 'string' || !password) return

    event.currentTarget.reset()
    setPasswordRequest(null)
    passwordRequest?.submit(password)
  }

  return (
    <div className="min-h-dvh">
      <header className="border-b bg-card">
        <div className="page-width flex h-17 items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xl font-bold tracking-tight">
            <span className="grid size-9 place-items-center rounded-[10px] bg-primary text-primary-foreground">
              <ChartNoAxesColumnIncreasing className="size-5" aria-hidden="true" />
            </span>
            finctl<span className="sr-only"> credit-card spending</span>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <LockKeyhole className="size-4 text-primary" aria-hidden="true" />
            <span>On-device analysis</span>
          </div>
        </div>
      </header>

      <main className="page-width py-8 sm:py-12">
        {statement ? (
          <Suspense fallback={<p role="status">Opening report…</p>}>
            <Report statement={statement} onClear={() => setStatement(null)} />
          </Suspense>
        ) : (
          <section className="upload-shell grid items-center gap-8 rounded-3xl p-6 sm:p-10 lg:grid-cols-[1fr_0.9fr] lg:gap-14 lg:p-14">
            <div className="max-w-lg">
              <h1 className="text-balance text-[clamp(2.5rem,5.4vw,4.6rem)] leading-[1.02] font-semibold tracking-[-0.07em] text-white">
                See where your money went.
              </h1>
              <p className="mt-5 max-w-sm text-base leading-relaxed text-[#d5e7dc] sm:text-lg">
                Open an HDFC credit-card statement to see your biggest spending category and the purchases behind it.
              </p>
            </div>

            <Card className="rounded-2xl py-0 shadow-xl ring-0">
              <CardContent className="p-3 sm:p-4">
                <div
                  className="flex min-h-66 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-input px-4 py-7 text-center transition-colors data-[dragging=true]:border-primary data-[dragging=true]:bg-accent"
                  data-dragging={dragging}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setDragging(true)
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault()
                    setDragging(false)
                    const [file] = event.dataTransfer.files
                    if (file) void openFile(file)
                  }}
                >
                  <div className="grid size-12 place-items-center rounded-2xl bg-accent text-primary">
                    <FileText className="size-6" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 max-w-full">
                    <h2 className="text-lg font-semibold tracking-tight">Open a statement</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Drag a PDF here or choose a file.
                    </p>
                  </div>
                  <input
                    ref={filePicker}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    aria-label="HDFC statement PDF"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0]
                      event.currentTarget.value = ''
                      if (file) void openFile(file)
                    }}
                  />
                  {filename ? (
                    <div className="flex flex-wrap items-center justify-center gap-2" role="status">
                      <LoaderCircle className="size-4 animate-spin text-primary" aria-hidden="true" />
                      <span className="max-w-56 truncate text-sm" title={filename}>Reading {filename}</span>
                      <Button variant="ghost" size="sm" onClick={cancelImport}>Cancel</Button>
                    </div>
                  ) : (
                    <Button size="lg" onClick={() => filePicker.current?.click()}>
                      <Upload aria-hidden="true" /> Choose PDF
                    </Button>
                  )}
                </div>
                {error && (
                  <Alert className="mt-3" variant="destructive" role="alert">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </section>
        )}
      </main>

      <Dialog open={passwordRequest !== null} onOpenChange={(open) => { if (!open) cancelImport() }}>
        <DialogContent showCloseButton={false}>
          <form onSubmit={submitPassword} className="grid gap-5" autoComplete="off">
            <DialogHeader>
              <DialogTitle>Unlock your statement</DialogTitle>
              <DialogDescription>The PDF password stays on your device.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="pdf-password">PDF password</Label>
              <Input
                id="pdf-password"
                name="password"
                type="password"
                autoComplete="off"
                required
                aria-invalid={passwordRequest?.incorrect || undefined}
                aria-describedby={passwordRequest?.incorrect ? 'password-error' : undefined}
              />
              {passwordRequest?.incorrect && (
                <p id="password-error" role="alert" className="text-sm text-destructive">Incorrect password. Try again.</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={cancelImport}>Cancel</Button>
              <Button type="submit">Unlock PDF</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

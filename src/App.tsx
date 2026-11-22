import { lazy, Suspense, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ChartNoAxesColumnIncreasing, FileText, LoaderCircle, LockKeyhole, Upload } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
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
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
            <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <ChartNoAxesColumnIncreasing className="size-4" aria-hidden="true" />
            </span>
            finctl<span className="sr-only"> credit-card spending</span>
          </div>
          <Badge variant="outline" className="h-7 gap-1.5 px-2.5 text-sm text-muted-foreground">
            <LockKeyhole aria-hidden="true" /> On-device analysis
          </Badge>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        {statement ? (
          <Suspense fallback={<p role="status">Opening report…</p>}>
            <Report statement={statement} onClear={() => setStatement(null)} />
          </Suspense>
        ) : (
          <section className="mx-auto grid max-w-2xl gap-5 sm:gap-6" aria-labelledby="upload-title">
            <div className="space-y-2">
              <h1 id="upload-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Statement analysis
              </h1>
              <p className="text-base text-muted-foreground">
                See your biggest spending category and the purchases behind it.
              </p>
            </div>

            <Card className="[--card-spacing:--spacing(4)] sm:[--card-spacing:--spacing(6)]">
              <CardHeader>
                <CardTitle><h2>HDFC credit-card statement</h2></CardTitle>
                <CardDescription>Password-protected PDFs are supported.</CardDescription>
              </CardHeader>
              <CardContent>
                <Empty
                  className="border border-input bg-muted/35 px-3 py-6 transition-colors data-[dragging=true]:border-primary data-[dragging=true]:bg-accent sm:px-6 sm:py-10"
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
                  <EmptyHeader>
                    <EmptyMedia variant="icon" className="bg-accent text-primary">
                      <FileText className="size-5" aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle className="text-base">Open a PDF statement</EmptyTitle>
                    <EmptyDescription className="hidden [@media(pointer:fine)]:block">Drop your file here or browse below.</EmptyDescription>
                  </EmptyHeader>
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
                  <EmptyContent>
                    {filename ? (
                      <div className="flex w-full min-w-0 flex-wrap items-center justify-center gap-2">
                        <div className="flex min-w-0 items-center gap-2" role="status">
                          <LoaderCircle className="size-4 shrink-0 motion-safe:animate-spin text-primary" aria-hidden="true" />
                          <span className="truncate" title={filename}>Reading {filename}</span>
                        </div>
                        <Button variant="ghost" className="min-h-11" onClick={cancelImport}>Cancel</Button>
                      </div>
                    ) : (
                      <Button className="min-h-11 w-full sm:w-auto" size="lg" onClick={() => filePicker.current?.click()}>
                        <Upload aria-hidden="true" /> Choose PDF
                      </Button>
                    )}
                  </EmptyContent>
                </Empty>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription className="wrap-anywhere">{error}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </section>
        )}
      </main>

      <Dialog open={passwordRequest !== null} onOpenChange={(open) => { if (!open) cancelImport() }}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:p-6" showCloseButton={false}>
          <form onSubmit={submitPassword} className="grid min-w-0 gap-5" autoComplete="off">
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
                className="h-11"
                autoComplete="off"
                required
                aria-invalid={passwordRequest?.incorrect || undefined}
                aria-describedby={passwordRequest?.incorrect ? 'password-error' : undefined}
              />
              {passwordRequest?.incorrect && (
                <p id="password-error" role="alert" className="text-sm text-destructive">Incorrect password. Try again.</p>
              )}
            </div>
            <DialogFooter className="grid grid-cols-2 sm:flex">
              <Button type="button" variant="outline" className="min-h-11" onClick={cancelImport}>Cancel</Button>
              <Button type="submit" className="min-h-11">Unlock PDF</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

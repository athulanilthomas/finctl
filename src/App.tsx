import { addTransitionType, startTransition, useLayoutEffect, useRef, useState, ViewTransition } from 'react'
import type { FormEvent } from 'react'
import { ChartNoAxesColumnIncreasing, FileText, LoaderCircle, LockKeyhole, Upload } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SpendingPreview } from '@/components/spending-preview'
import { ThemeToggle } from '@/components/theme-toggle'
import type { Statement } from '@/lib/statement'

const loadReport = () => import('@/components/report')
type OpenedReport = { statement: Statement; Component: Awaited<ReturnType<typeof loadReport>>['default'] }

export default function App() {
  const filePicker = useRef<HTMLInputElement>(null)
  const activeImport = useRef<AbortController | null>(null)
  const main = useRef<HTMLElement>(null)
  const hadReport = useRef(false)
  const [report, setReport] = useState<OpenedReport | null>(null)
  const [filename, setFilename] = useState('')
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [passwordRequest, setPasswordRequest] = useState<{
    submit: (password: string) => void
    incorrect: boolean
  } | null>(null)
  const reportOpen = report !== null
  const nativeScreenMotion = typeof document.startViewTransition === 'function' && CSS.supports('view-transition-class: screen-change')

  useLayoutEffect(() => {
    if (hadReport.current === reportOpen) return
    hadReport.current = reportOpen
    window.scrollTo({ top: 0, behavior: 'instant' })
    main.current?.querySelector('h1')?.focus({ preventScroll: true })
  }, [reportOpen])

  function cancelImport() {
    activeImport.current?.abort()
    activeImport.current = null
    setFilename('')
    setPasswordRequest(null)
  }

  function showScreen(next: OpenedReport | null) {
    const update = () => {
      if (next) cancelImport()
      setReport(next)
    }
    if (nativeScreenMotion && window.matchMedia('(prefers-reduced-motion: no-preference)').matches) {
      startTransition(() => {
        addTransitionType('screen-change')
        update()
      })
    } else {
      update()
    }
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
      const [statement, { default: Component }] = await Promise.all([
        import('@/lib/pdf').then(({ readStatement }) => readStatement(file, controller.signal, (submit, incorrect) => {
          if (!controller.signal.aborted) setPasswordRequest({ submit, incorrect })
        })),
        loadReport(),
      ])
      if (!controller.signal.aborted) showScreen({ statement, Component })
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
      <header className="border-b">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
            <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <ChartNoAxesColumnIncreasing className="size-4" aria-hidden="true" />
            </span>
            finctl<span className="sr-only"> credit-card spending</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Badge variant="outline" className="h-7 gap-1.5 px-2.5 text-sm text-muted-foreground">
              <LockKeyhole aria-hidden="true" />
              <span>On-device<span className="hidden sm:inline"> analysis</span></span>
            </Badge>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <ViewTransition default="none" update={{ default: 'none', 'screen-change': 'screen-change' }}>
        <main ref={main} data-native-screen-motion={nativeScreenMotion} className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
          {report ? (
            <report.Component statement={report.statement} onClear={() => showScreen(null)} />
          ) : (
            <section
              className="app-screen mx-auto grid max-w-2xl items-center gap-8 py-3 sm:gap-10 sm:py-8 lg:max-w-none lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-12"
              aria-labelledby="upload-title"
            >
              <div className="grid min-w-0 gap-6 sm:gap-8">
                <div className="space-y-4">
                  <h1 id="upload-title" tabIndex={-1} className="text-[clamp(2.625rem,6.6vw,5.25rem)] leading-[1.02] font-semibold tracking-[-0.065em] text-balance outline-none">
                    See where your money went.
                  </h1>
                  <p className="max-w-md text-lg leading-relaxed text-pretty text-muted-foreground sm:text-xl">
                    Open an HDFC credit-card statement to see your monthly totals, top categories, and the purchases behind them.
                  </p>
                </div>

                <div className="grid min-w-0 max-w-xl gap-3">
                  <Empty
                    className="items-stretch justify-between gap-4 border border-input bg-card px-4 py-4 text-left text-wrap transition-colors data-[dragging=true]:border-primary data-[dragging=true]:bg-accent sm:flex-row sm:items-center"
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
                    <EmptyHeader className="min-w-0 flex-row items-start gap-3 sm:items-center">
                      <EmptyMedia variant="icon" className="mb-0 size-11">
                        <FileText className="size-5" aria-hidden="true" />
                      </EmptyMedia>
                      <div className="min-w-0">
                        <EmptyTitle className="text-base">
                          <h2>Open a statement</h2>
                        </EmptyTitle>
                        <EmptyDescription>Password-protected PDFs supported.</EmptyDescription>
                      </div>
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
                    <EmptyContent className="max-w-none sm:w-auto sm:max-w-52">
                      {filename ? (
                        <div className="flex w-full min-w-0 flex-wrap items-center justify-center gap-1.5 sm:justify-end">
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
                  <p className="hidden text-sm text-muted-foreground [@media(pointer:fine)]:block">You can also drop a PDF into the box.</p>
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription className="wrap-anywhere">{error}</AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>

              <SpendingPreview />
            </section>
          )}
        </main>
      </ViewTransition>

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

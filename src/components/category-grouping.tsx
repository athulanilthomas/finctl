import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Cpu, LoaderCircle, Sparkles } from 'lucide-react'
import geminiLogo from '@/assets/gemini.svg'
import { GeminiCategories } from '@/components/gemini-categories'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import type { Category } from '@/lib/categories'

const aiIconClass = 'grid size-10 shrink-0 place-items-center rounded-lg bg-linear-to-br from-(--chart-2)/20 to-(--chart-2)/5 text-blue-700 ring-1 ring-inset ring-(--chart-2)/25 dark:text-blue-300'
const providerClass = 'h-auto min-w-0 justify-start gap-3 rounded-lg p-3 text-left whitespace-normal disabled:opacity-100 disabled:shadow-none motion-reduce:transition-none'
const arrowClass = 'ml-auto size-4 motion-safe:transition-transform motion-safe:group-hover/button:translate-x-0.5'
const geminiKeyStorage = 'finctl-gemini-key'

function readGeminiKey() {
  try {
    return window.sessionStorage.getItem(geminiKeyStorage) || null
  } catch {
    return null
  }
}

export function CategoryGrouping({ names, labels, uncategorized, browser, onBrowser, onGeminiBatch }: {
  names: string[]
  labels: Map<string, Category>
  uncategorized: number
  browser: {
    availability: Availability | null
    hasMerchants: boolean
    running: boolean
    download: number | null
    failed: boolean
  }
  onBrowser: () => void
  onGeminiBatch: (batch: Map<string, Category>) => void
}) {
  const [open, setOpen] = useState(false)
  const [gemini, setGemini] = useState(false)
  const [savedKey, setSavedKey] = useState(readGeminiKey)
  const title = useRef<HTMLHeadingElement>(null)
  const { availability, hasMerchants, running, download, failed } = browser
  const completed = names.length > 0 && labels.size === names.length
  const browserReady = availability !== null && availability !== 'unavailable' && hasMerchants && !running
  const geminiHasMerchants = names.length > 0 && !completed
  const geminiReady = !running && (geminiHasMerchants || savedKey !== null)
  const browserDetails = running ? 'Grouping purchases on this device…'
    : availability === null ? 'Checking browser support…'
      : availability === 'unavailable' ? 'On-device AI is unavailable in this browser.'
        : hasMerchants ? 'Group uncategorized purchases this month. Data stays on this device.'
          : 'No remaining purchases to group this month.'
  const geminiDetails = running ? 'Available when browser grouping finishes.'
    : geminiHasMerchants ? 'Group merchants across the statement using your Gemini API key.'
      : savedKey ? 'Manage the API key saved for this tab.'
        : completed ? 'All eligible merchants in this statement have been reviewed.'
          : 'No eligible merchant names in this statement.'

  useEffect(() => {
    if (open) title.current?.focus()
  }, [open, gemini])

  function changeSavedKey(key: string | null) {
    try {
      if (key === null) window.sessionStorage.removeItem(geminiKeyStorage)
      else window.sessionStorage.setItem(geminiKeyStorage, key)
      setSavedKey(key)
      return true
    } catch {
      return false
    }
  }

  if (!names.length && !uncategorized && !running && !failed) return null

  let status = 'Choose a provider to review merchant categories.'
  if (running) {
    status = download === null ? 'Grouping purchases on this device…' : 'Downloading Chrome’s on-device model…'
  } else if (failed) {
    status = 'Browser grouping couldn’t finish. Retry or edit categories in Transactions.'
  } else if (completed) {
    status = `Gemini reviewed ${labels.size} ${labels.size === 1 ? 'merchant' : 'merchants'} in this statement.`
  } else if (uncategorized) {
    status = `${uncategorized} ${uncategorized === 1 ? 'purchase needs' : 'purchases need'} a category.`
  }

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (next) setGemini(false)
      setOpen(next)
    }}>
      <Card size="sm" className="relative isolate min-w-0">
        <div aria-hidden="true" className="spending-grid pointer-events-none absolute inset-y-0 right-0 -z-10 w-2/5 -scale-x-100 opacity-80" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-radial-[ellipse_at_top_right] from-(--chart-2)/12 to-transparent to-55%" />
        <CardContent className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="flex min-w-0 items-start gap-3">
            <span className={aiIconClass} aria-hidden="true">
              {running ? <LoaderCircle className="size-[18px] motion-safe:animate-spin" /> : <Sparkles className="size-[18px]" />}
            </span>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base tracking-tight"><h2>Merchant grouping</h2></CardTitle>
              <div role="status" className="space-y-2">
                <CardDescription>{status}</CardDescription>
                {running && download !== null && <Progress value={download * 100} aria-label="Model download" className="max-w-xs" />}
              </div>
            </div>
          </div>
          <DialogTrigger asChild>
            <Button className="relative isolate min-h-11 justify-between overflow-hidden rounded-lg px-3.5 shadow-sm before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-linear-to-r before:from-(--chart-2)/25 before:to-transparent motion-reduce:transition-none sm:min-w-36">
              Group with AI <ArrowRight aria-hidden="true" className={arrowClass} />
            </Button>
          </DialogTrigger>
        </CardContent>
      </Card>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto p-4 sm:max-w-lg sm:p-6"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          title.current?.focus()
        }}
      >
        <DialogHeader className="max-sm:grid max-sm:grid-cols-[auto_minmax(0,1fr)] max-sm:items-center max-sm:gap-x-3">
          <span aria-hidden="true" className={`${aiIconClass} sm:mb-1`}>
            {gemini ? <img src={geminiLogo} alt="" width={18} height={18} /> : <Sparkles className="size-[18px]" />}
          </span>
          <DialogTitle ref={title} tabIndex={-1} className="text-xl leading-tight font-semibold tracking-tight outline-none max-sm:pr-6">
            {gemini ? (geminiHasMerchants ? 'Group with Gemini' : 'Manage Gemini key') : 'Group with AI'}
          </DialogTitle>
          <DialogDescription className="max-sm:col-span-2">
            {!gemini ? 'Choose how to group your purchases.'
              : geminiHasMerchants ? 'The merchant names below go to Google through finctl. Your PDF and transaction details stay in your browser.'
                : 'The key stays available after refreshing this tab, until you forget it or the session ends.'}
          </DialogDescription>
        </DialogHeader>
        {gemini ? open && (
          <GeminiCategories
            names={names}
            labels={labels}
            savedKey={savedKey}
            onSavedKeyChange={changeSavedKey}
            onBatch={onGeminiBatch}
            onBack={() => setGemini(false)}
            onComplete={() => setOpen(false)}
          />
        ) : (
          <div className="panel-enter grid min-w-0 gap-2.5">
            <Button variant="outline" className={providerClass} aria-labelledby="browser-ai-title" aria-describedby="browser-ai-details" disabled={!browserReady} onClick={() => {
              onBrowser()
              setOpen(false)
            }}>
              <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted ring-1 ring-inset ring-foreground/10"><Cpu className="size-[18px]" /></span>
              <span className="min-w-0 space-y-0.5">
                <span id="browser-ai-title" className="block font-semibold">Browser AI</span>
                <span id="browser-ai-details" className="block text-sm leading-snug font-normal text-muted-foreground">{browserDetails}</span>
              </span>
              {browserReady && <ArrowRight aria-hidden="true" className={arrowClass} />}
            </Button>
            <Button variant="outline" className={providerClass} aria-labelledby="gemini-title" aria-describedby="gemini-details" disabled={!geminiReady} onClick={() => setGemini(true)}>
              <span aria-hidden="true" className={aiIconClass}><img src={geminiLogo} alt="" width={18} height={18} /></span>
              <span className="min-w-0 space-y-0.5">
                <span id="gemini-title" className="block font-semibold">Gemini</span>
                <span id="gemini-details" className="block text-sm leading-snug font-normal text-muted-foreground">{geminiDetails}</span>
              </span>
              {geminiReady && <ArrowRight aria-hidden="true" className={arrowClass} />}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

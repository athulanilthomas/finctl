import { getDocument, GlobalWorkerOptions, InvalidPDFException, OPS, PasswordResponses } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import { scanStatement } from './ocria.ts'
import { parseStatement } from './statement.ts'

GlobalWorkerOptions.workerSrc = workerUrl

const imageOperators = new Set<number>([
  OPS.paintImageXObject,
  OPS.paintInlineImageXObject,
  OPS.paintInlineImageXObjectGroup,
  OPS.paintImageXObjectRepeat,
])

export type PdfReadMethod = 'auto' | 'ocria'

type ImportCallbacks = {
  requestPassword: (submit: (password: string) => void, incorrect: boolean) => void
  requestScan: (pages: number, start: () => void) => void
  onScanProgress: (completed: number, pages: number) => void
}

function textLines(items: TextItem[]) {
  const positioned = items.filter(({ str }) => str.trim())
  positioned.sort((a, b) => b.transform[5] - a.transform[5])

  const rows: { y: number; items: TextItem[] }[] = []
  for (const item of positioned) {
    const row = rows.at(-1)
    const y = item.transform[5]
    if (row && Math.abs(row.y - y) <= 2) row.items.push(item)
    else rows.push({ y, items: [item] })
  }

  return rows.map(({ items }) => {
    items.sort((a, b) => a.transform[4] - b.transform[4])
    let line = ''
    let end = 0

    for (const item of items) {
      const gap = item.transform[4] - end
      if (line) line += gap > 9 ? '  ' : ' '
      line += item.str.trim()
      end = item.transform[4] + item.width
    }
    return line
  })
}

export async function readStatement(
  file: File,
  signal: AbortSignal,
  { requestPassword, requestScan, onScanProgress }: ImportCallbacks,
  method: PdfReadMethod,
) {
  const data = new Uint8Array(await file.arrayBuffer())
  signal.throwIfAborted()

  let password: string | undefined
  const task = getDocument({ data, useWasm: false })
  task.onPassword = (submit: (password: string) => void, reason: number) =>
    requestPassword((value) => {
      password = value
      submit(value)
    }, reason === PasswordResponses.INCORRECT_PASSWORD)

  const abort = () => { void task.destroy().catch(() => {}) }
  signal.addEventListener('abort', abort, { once: true })
  const pages: string[][] = []
  const scanned: number[] = []
  let totalPages = 0

  try {
    const pdf = await task.promise
    totalPages = pdf.numPages
    if (method === 'auto') {
      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
        signal.throwIfAborted()
        const page = await pdf.getPage(pageNumber)
        const { items } = await page.getTextContent()
        const lines = textLines(items.filter((item) => 'str' in item))
        pages.push(lines)
        const hasText = lines.some((line) => /\p{L}{2}/u.test(line) && !/^page\s+\d+\s+of\s+\d+\b/i.test(line))
        if (!hasText) {
          const { fnArray } = await page.getOperatorList()
          if (fnArray.some((operator) => imageOperators.has(operator))) scanned.push(pageNumber)
          page.cleanup()
        }
      }
    }
  } catch (error) {
    if (error instanceof InvalidPDFException) throw new Error('This file could not be opened as a PDF.')
    throw error
  } finally {
    signal.removeEventListener('abort', abort)
    if (!task.destroyed) await task.destroy()
  }

  signal.throwIfAborted()
  const readAll = method === 'ocria'
  const requestedPages = readAll ? totalPages : scanned.length
  if (!requestedPages) return parseStatement(pages)

  await new Promise<void>((resolve, reject) => {
    const cancel = () => reject(signal.reason)
    signal.addEventListener('abort', cancel, { once: true })
    requestScan(requestedPages, () => {
      signal.removeEventListener('abort', cancel)
      resolve()
    })
  })

  signal.throwIfAborted()
  onScanProgress(0, requestedPages)
  const scannedPages = await scanStatement({
    data: await file.arrayBuffer(),
    password,
    pages: readAll ? undefined : scanned,
  }, signal, (completed) => onScanProgress(completed, requestedPages))
  for (const page of scannedPages) pages[page.number - 1] = page.lines

  return {
    ...parseStatement(pages),
    scan: { pages: requestedPages, readAll, reviewPages: scannedPages.filter((page) => page.needsReview).map((page) => page.number) },
  }
}

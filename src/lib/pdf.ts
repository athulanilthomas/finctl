import { getDocument, GlobalWorkerOptions, InvalidPDFException, PasswordResponses } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import { parseStatement } from './statement.ts'

GlobalWorkerOptions.workerSrc = workerUrl

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
  requestPassword: (submit: (password: string) => void, incorrect: boolean) => void,
) {
  const data = new Uint8Array(await file.arrayBuffer())
  signal.throwIfAborted()

  const task = getDocument({ data, useWasm: false })
  task.onPassword = (submit: (password: string) => void, reason: number) =>
    requestPassword(submit, reason === PasswordResponses.INCORRECT_PASSWORD)

  const abort = () => { void task.destroy().catch(() => {}) }
  signal.addEventListener('abort', abort, { once: true })

  try {
    const pdf = await task.promise
    const pages: string[][] = []

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      signal.throwIfAborted()
      const page = await pdf.getPage(pageNumber)
      const { items } = await page.getTextContent()
      pages.push(textLines(items.filter((item) => 'str' in item)))
    }

    return parseStatement(pages)
  } catch (error) {
    if (error instanceof InvalidPDFException) throw new Error('This file could not be opened as a PDF.')
    throw error
  } finally {
    signal.removeEventListener('abort', abort)
    if (!task.destroyed) await task.destroy()
  }
}

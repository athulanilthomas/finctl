export type ScanRequest = {
  data: ArrayBuffer
  password?: string
  pages: number[]
}

type ScanPage = { number: number; lines: string[]; needsReview: boolean }

export type ScanMessage =
  | { type: 'progress'; completed: number }
  | { type: 'result'; pages: ScanPage[] }
  | { type: 'error' }

export async function scanStatement(request: ScanRequest, signal: AbortSignal, onProgress: (completed: number) => void) {
  signal.throwIfAborted()
  const worker = new Worker(new URL('./ocria.worker.ts', import.meta.url), { type: 'module' })
  const listeners = new AbortController()

  try {
    return await new Promise<ScanPage[]>((resolve, reject) => {
      const fail = () => reject(new Error('This PDF could not be scanned on this device. Try again or open the original statement PDF.'))
      signal.addEventListener('abort', () => reject(signal.reason), { once: true, signal: listeners.signal })
      worker.onmessage = ({ data }: MessageEvent<ScanMessage>) => {
        if (data.type === 'progress') onProgress(data.completed)
        else if (data.type === 'result') resolve(data.pages)
        else fail()
      }
      worker.onerror = fail
      worker.onmessageerror = fail
      worker.postMessage(request, [request.data])
    })
  } finally {
    listeners.abort()
    worker.terminate()
  }
}

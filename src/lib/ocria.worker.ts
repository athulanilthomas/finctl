import init, { LiteParse, OcriaNano } from '@llamaindex/liteparse-wasm'
import wasmUrl from '@llamaindex/liteparse-wasm/liteparse_wasm_bg.wasm?url'
import type { ScanMessage, ScanRequest } from './ocria.ts'

function send(message: ScanMessage) {
  self.postMessage(message)
}

self.onmessage = async ({ data: { data, password, pages } }: MessageEvent<ScanRequest>) => {
  try {
    await init({ module_or_path: wasmUrl })
    const model = await OcriaNano.fromUrl({
      baseUrl: new URL('/ocria-nano-1', self.location.origin).href,
      scripts: ['latin'],
      layout: false,
    })
    let completed = 0
    const parser = LiteParse.withOcriaNano({
      password,
      targetPages: pages?.join(','),
      includeComplexity: pages === undefined,
      ocrEnabled: true,
      outputFormat: 'text',
      extractLinks: false,
      dpi: 200,
      onOcrPage: () => send({ type: 'progress', completed: ++completed }),
    }, model)
    const result = await parser.parse(new Uint8Array(data))
    if (result.pageErrors.length || result.pages.length !== (pages?.length ?? result.totalPages)) {
      send({ type: 'error' })
      return
    }
    send({
      type: 'result',
      pages: result.pages.map(({ pageNum, text, textItems, complexity }) => {
        const hasOcrText = textItems.some(({ confidence }) => confidence !== undefined)
        const needsOcr = pages !== undefined || Boolean(complexity?.needsOcr &&
          (complexity.fullPageImage || complexity.hasSubstantialImages || complexity.isGarbled))
        return {
          number: pageNum,
          lines: text.split('\n'),
          needsReview: (needsOcr && !hasOcrText) ||
            textItems.some(({ confidence = 1 }) => confidence < 0.8),
        }
      }),
    })
  } catch {
    send({ type: 'error' })
  }
}

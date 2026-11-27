# finctl

See your monthly spending from an HDFC credit-card statement PDF. The file, password, and report stay in the browser. Use Chrome’s on-device AI or opt in to sending merchant names to Gemini with your own API key.

Scanned pages use [OCRia-nano-1 by LlamaIndex](https://huggingface.co/llamaindex/OCRia-nano-1/tree/53d45fe6803a568deedb081550c2fdb97cc99f97) under the [OCRia model license](public/ocria-nano-1/LICENSE.txt). Choose **Read with OCRia** to use LiteParse for the entire PDF.

## Run locally

Requires Node.js 26 and pnpm 12.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Run `pnpm test` for tests and `pnpm build` to generate `dist/`. Use `vercel dev` to run the Gemini endpoint locally.

On Vercel, use the Vite preset and set `ENABLE_EXPERIMENTAL_COREPACK=1` to use the pinned pnpm version.

# finctl

See your monthly spending from a text-based HDFC credit-card statement PDF. The file, password, and report stay in the browser. Use Chrome’s on-device AI or opt in to sending merchant names to Gemini with your own API key.

## Run locally

Requires Node.js 24 and pnpm 12.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Run `pnpm test` for tests and `pnpm build` to generate `dist/`. Use `vercel dev` to run the Gemini endpoint locally.

On Vercel, use the Vite preset and set `ENABLE_EXPERIMENTAL_COREPACK=1` to use the pinned pnpm version.

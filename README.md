# finctl

See your monthly spending from a text-based HDFC credit-card statement PDF. The file, password, and report stay in the browser. Chrome’s on-device AI can help group purchases on supported devices.

## Run locally

Requires Node.js 24 and pnpm 12.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Run `pnpm test` for the statement parser tests. Run `pnpm build` to generate `dist/`.

On Vercel, use the Vite preset and set `ENABLE_EXPERIMENTAL_COREPACK=1` to use the pinned pnpm version.

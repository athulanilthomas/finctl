# finctl

See your monthly spending from a text-based HDFC credit-card statement PDF. The file, password, and report stay in the browser. Chrome’s on-device AI can help group purchases on supported devices.

## Run locally

Requires Node.js 24.

```sh
npm ci
npm run dev
```

Run `npm test` for the statement parser tests. Run `npm run build` to generate `dist/`. On Vercel, use the Vite preset.

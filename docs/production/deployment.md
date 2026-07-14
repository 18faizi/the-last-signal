# Deployment

## Build output

`pnpm build` produces a fully static site in `dist/`:

- `index.html` — entry document
- `assets/*.js` — hashed application + engine bundles (ES2022 modules)
- `assets/*.wasm` — the Havok physics runtime
- `assets/*.css` — hashed stylesheet
- source maps (`.map`) for debugging production issues

No server runtime, API, database or environment variables are required.
Direct navigation to `/` is the only route; there is no client-side router,
so no SPA rewrite rules are needed.

## Vercel

The repository includes `vercel.json`:

```json
{
  "framework": "vite",
  "buildCommand": "pnpm build",
  "outputDirectory": "dist"
}
```

With the repo connected to a Vercel project via the GitHub integration:

- pushes to the default branch deploy to **production**
- pushes to any other branch / PR deploy to **preview** URLs

Vercel detects pnpm from `pnpm-lock.yaml` and the `packageManager` field.
No secrets are required, and CI does not deploy — deployment is entirely
Vercel's Git integration.

## Local verification of the production build

```bash
pnpm build
pnpm preview   # serves dist/ at a local URL
```

Verify: loading screen → development scene → falling sphere →
`Milestone 0.1 — Foundation Ready` marker. The debug overlay must NOT appear
in production builds (it is development-only), so the backquote shortcut
doing nothing is expected there.

## Any static host

Because the output is plain static files, any static host (GitHub Pages,
Netlify, S3+CloudFront) works: serve `dist/` as the site root. Assets use
root-relative paths (`/assets/...`), so host at a domain root or set Vite's
`base` if deploying under a subpath.

# PDF PRIMA Editor — Vercel deployable build

Standalone, self-contained version of the app ready to deploy on Vercel via GitHub.

## Deploy on Vercel

1. Push this repo to GitHub.
2. In Vercel, click **Add New → Project** and import the repository.
3. **Just click Deploy.** No configuration needed.

The root `vercel.json` and `.vercelignore` files tell Vercel to:
- Ignore the Replit monorepo files (pnpm workspace, lockfile, etc.)
- Install and build from the `vercel-app/` folder using npm
- Serve `vercel-app/dist` as the output

No environment variables required.

## Local development

```bash
cd vercel-app
npm install
npm run dev
```

Open http://localhost:5173

## Build locally

```bash
npm run build
npm run preview
```

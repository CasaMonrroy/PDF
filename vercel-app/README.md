# PDF PRIMA Editor — Vercel deployable build

Standalone, self-contained version of the app ready to deploy on Vercel via GitHub.

## Deploy on Vercel

1. Push this repo to GitHub.
2. In Vercel, click **Add New → Project** and import the repository.
3. In the **Configure Project** step, set:
   - **Root Directory**: `vercel-app`
   - **Framework Preset**: Vite (auto-detected)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `dist` (default)
   - **Install Command**: `npm install` (default)
4. Click **Deploy**.

That's it. No environment variables required.

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

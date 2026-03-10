# Deploy Guide

Instructions for deploying Eloqura DEX to Netlify.

## Prerequisites

- Netlify CLI installed (`npm i -g netlify-cli`)
- Netlify account linked to the project
- Neon PostgreSQL database provisioned

## Build

```bash
cd eloqura-claude-workspace
npx vite build --config vite.config.netlify.ts
```

Output: `dist/public/`

## Deploy

```bash
npx netlify deploy --prod --dir=dist/public
```

## Production URL

**Live:** [https://eloqura.oeconomia.io](https://eloqura.oeconomia.io)

## Netlify Configuration

From `netlify.toml`:
- Publish directory: `dist/public`
- Functions directory: `netlify/functions/dist`
- Node version: 20
- External modules: `ws` (for Neon PostgreSQL)
- SPA redirect: `/*` → `/index.html` (status 200)

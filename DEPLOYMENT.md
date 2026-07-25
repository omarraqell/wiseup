# WiseUp Deployment Guide

This repository is now prepared for:

- Frontend: Cloudflare Workers using the OpenNext adapter for Next.js.
- Backend API: Render Node web service.
- AI service: Render Docker web service.
- Database/Auth: Supabase.

Cloudflare's current Next.js guidance recommends Workers/OpenNext for full Next.js apps. This app uses a route handler and Supabase server cookie refresh, so do not deploy it as a simple static Pages export. The frontend keeps `src/middleware.ts` instead of Next 16 `src/proxy.ts` because Cloudflare/OpenNext supports Edge middleware, while Node.js middleware/proxy is not supported yet.

## Files Added

| File | Purpose |
| --- | --- |
| `frontend/wrangler.jsonc` | Cloudflare Worker entry, assets directory, compatibility flag. |
| `frontend/open-next.config.ts` | OpenNext Cloudflare adapter config. |
| `frontend/public/_headers` | Long-term cache headers for Next static assets. |
| `frontend/.dev.vars` | Local Cloudflare preview environment selector. |
| `frontend/.env.example` | Frontend deployment variables. |
| `render.yaml` | Render Blueprint for the Node backend and Python AI service. |

## 1. Render: Backend + AI Service

1. Push this repository to GitHub.
2. In Render, create a new Blueprint from the repository root.
3. Render will read `render.yaml` and create:
   - `wiseup-backend`
   - `wiseup-ai-service`
4. Fill the prompted secret values:

```bash
DATABASE_URL=your-supabase-postgres-url
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
CORS_ORIGIN=https://your-cloudflare-domain
OPENAI_API_KEY=your-openai-key
TAVILY_API_KEY=your-tavily-key
GMAIL_APP_PASSWORD=your-gmail-app-password
```

Notes:

- `AI_SERVICE_HOSTPORT` is wired automatically from `wiseup-ai-service`.
- `PORT` is provided by Render; do not hardcode it.
- `preDeployCommand` runs `prisma migrate deploy` before the backend starts.
- The AI service builds the Chroma index on first container start if it is missing.

Health checks:

```bash
https://wiseup-backend.onrender.com/api/health
https://wiseup-ai-service.onrender.com/health
```

## 2. Cloudflare: Frontend

From `frontend/`, the important scripts are:

```bash
npm run cf:build
npm run preview
npm run deploy
```

For Cloudflare Workers Builds or a connected Git repo, use:

```bash
Build command: npm ci && npm run cf:build
Deploy command: npm run deploy
Root directory: frontend
```

Set these Cloudflare build/runtime variables:

```bash
NEXT_PUBLIC_API_URL=https://wiseup-backend.onrender.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

After deploying the frontend, update Render's `CORS_ORIGIN` value to your final Cloudflare URL.

## 3. Local Checks

Backend:

```bash
cd backend
npm ci
npm run build
npm start
```

Frontend:

```bash
cd frontend
npm ci
npm run cf:build
npm run preview
```

## 4. Post-Deployment Checklist

- [ ] Backend health returns `ok`.
- [ ] AI service health returns `ok`.
- [ ] Cloudflare frontend loads.
- [ ] Products load from the Render backend.
- [ ] Product images load from `https://wiseup-backend.onrender.com/images/...`.
- [ ] Supabase login/signup works.
- [ ] Admin page can call protected API routes.
- [ ] Chat widget can call `/api/chat`.
- [ ] Render `CORS_ORIGIN` matches the Cloudflare production domain.

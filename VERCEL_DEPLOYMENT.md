# Vercel deployment

Deploy this monorepo as two Vercel projects connected to the same GitHub
repository. Do not commit either local `.env` file.

## 1. Backend project

- Repository: `njeevan260-afk/26109`
- Root Directory: `backend/herd-vitals-backend`
- Framework: FastAPI (detected through `index.py`)

Set these variables for Production and, if required, Preview:

```env
SUPABASE_URL=https://wfadjrtbgtiquphrtnvn.supabase.co
SUPABASE_SECRET_KEY=sb_secret_replace_me
DEVICE_INGESTION_KEY=replace_with_a_long_random_secret
CORS_ORIGINS=https://your-frontend-project.vercel.app
MODEL_ARTIFACT_PATH=/tmp/mastitis-risk-model.joblib
```

Mark `SUPABASE_SECRET_KEY` and `DEVICE_INGESTION_KEY` as sensitive. The legacy
`SUPABASE_SERVICE_ROLE_KEY` is supported as an alternative, but do not configure
both. Never place either backend key in the frontend project or hardware.

For preview frontend deployments, optionally set a narrowly scoped regex:

```env
CORS_ORIGIN_REGEX=^https://.*-your-vercel-account\.vercel\.app$
```

Deploy the backend first and verify:

```text
GET https://your-backend-project.vercel.app/health
GET https://your-backend-project.vercel.app/api/test-supabase
```

The Vercel filesystem is read-only except for `/tmp`. Model artifacts written
there are instance-local and ephemeral; Supabase remains the durable data store.

## 2. Frontend project

- Repository: `njeevan260-afk/26109`
- Root Directory: `frontend`
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`

Set:

```env
VITE_API_URL=https://your-backend-project.vercel.app
VITE_SUPABASE_URL=https://wfadjrtbgtiquphrtnvn.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_me
```

All `VITE_` variables are present in the browser bundle. Only use the Supabase
publishable key here. `frontend/vercel.json` sends client-side routes such as
`/login`, `/dashboard`, and `/real-readings` to `index.html`.

## 3. Supabase Auth URLs

In **Supabase > Authentication > URL Configuration**, set:

```text
Site URL: https://your-frontend-project.vercel.app
Redirect URL: https://your-frontend-project.vercel.app/**
Local redirect: http://localhost:3000/**
```

Add a Vercel preview wildcard only if preview authentication is required.

## 4. Redeploy and verify

Environment-variable changes apply only to new deployments. Redeploy both
projects after changing them, then verify signup confirmation, login, role
approval, dashboard API loading, and real hardware ingestion.

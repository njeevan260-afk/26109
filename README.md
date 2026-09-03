# HerdVitals - SIH 26109 Prototype

HerdVitals is an AI/IoT prototype for early bovine mastitis risk monitoring. The current build includes a React dashboard, FastAPI backend, Supabase data layer, Supabase Auth with database-backed RBAC, a validated sensor-ingestion contract, animal and herd risk views, alerts, GIS visualization, and a persisted prototype Random Forest model.

## Current prototype status

- Supabase connection: working
- Dashboard and GIS APIs: working against the current schema
- Sensor data: 14,400 simulated EC and temperature readings
- Model: persisted Random Forest prototype trained on simulated threshold labels
- Prediction preview: read-only `GET`; opening pages does not add database rows
- Prediction recomputation: explicit `POST`; saves one prediction and may create a deduplicated high-risk alert
- Hardware ingestion: validated EC/TEMP batch endpoint
- WhatsApp alerts: YCloud utility-template delivery for HIGH/MODERATE live risk,
  with explicit user opt-in and one delivery per cow/recipient every 24 hours
- Clinical validation: not completed
- Scientific pipeline: one event-based 7-to-14-day label, leakage-safe temporal
  features, chronological evaluation, and Logistic/RF/ExtraTrees/XGBoost
  comparison are implemented separately from the live prototype model
- Access control: Supabase email/password sessions, administrator-approved roles,
  protected FastAPI routes, and separate role-dashboard entry points

The model output must be described as a prototype risk signal, not a veterinary diagnosis or a clinically validated 7-14 day forecast.

## Run the backend

```powershell
cd backend\herd-vitals-backend
copy .env.example .env
venv\Scripts\python.exe main.py
```

Required backend environment variables:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (preferred) or the legacy `SUPABASE_SERVICE_ROLE_KEY`
- `DEVICE_INGESTION_KEY` for authenticated hardware ingestion
- `YCLOUD_API_KEY`, `YCLOUD_WHATSAPP_FROM`,
  `YCLOUD_WHATSAPP_TEMPLATE_NAME`, `YCLOUD_WHATSAPP_TEMPLATE_LANGUAGE`, and
  `YCLOUD_WEBHOOK_SECRET` for WhatsApp risk alerts

The API and Swagger documentation run at `http://127.0.0.1:8000` and `http://127.0.0.1:8000/docs`.

## Run the frontend

```powershell
cd frontend
npm install
npm run dev
```

Copy `frontend/.env.example` to `frontend/.env` and set:

- `VITE_API_URL=auto` in local development, so desktop and phone browsers call
  port 8000 on the same hostname used to open the frontend
- `VITE_PUBLIC_SITE_URL` set to the deployed frontend URL, or the computer's
  LAN URL when testing confirmation and password-reset emails from a phone
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (the public browser key, never the service-role key)

## Enable authentication and RBAC

1. Apply the migrations in `supabase/migrations/` in timestamp order in the
   Supabase SQL editor. The two `add_admin_*` migrations must be run separately
   and in order because PostgreSQL commits new enum values between migrations.
2. In Supabase, open **Authentication > Hooks > Custom Access Token** and
   select `public.custom_access_token_hook`.
3. In **Authentication > Email Templates > Reset password**, use the contents
   of `supabase/templates/recovery.html`. This routes the token through the app
   before verification so email link scanners cannot consume the one-time link.
4. Create normal accounts through `/register`. Dairy farmers are activated
   automatically after Auth signup/email confirmation. Veterinarians, dairy
   cooperatives, and animal-health authorities enter the admin waiting list.
5. In **Authentication > Users > Add user**, create `njeevan260@gmail.com` and
   set its password. Do not insert passwords directly into `auth.users`.
6. Run `supabase/bootstrap_admin.sql` in the SQL editor to assign the protected
   `ADMIN` role to that existing Auth user.
7. Sign in as the admin and use `/portal/admin` to approve or reject waiting
   applications. Supabase Realtime refreshes the queue; a 30-second polling
   fallback covers temporary channel interruptions.

`ADMIN` is deliberately absent from public registration and the approval API
cannot modify another administrator. Role changes are server-controlled.

Role approval and API permissions are server-controlled. The current RBAC is
application-wide; farm/cooperative tenant membership and row ownership must be
added before a production multi-organization deployment.

## Important API flows

- `GET /api/dashboard/summary` - herd KPIs and history
- `GET /api/predict/{animal_id}` - compute a preview without database writes
- `POST /api/predict/{animal_id}` - explicitly recompute and persist risk
- `GET /api/model/status` - model mode, training time and validation disclosure
- `POST /api/model/train` - start background prototype training
- `POST /api/readings` - ingest a validated hardware batch
- `GET /api/mastitis-events` - list confirmed/suspected event ground truth
- `POST /api/mastitis-events` - record a validated diagnostic event (migration required)
- `PATCH /api/alerts/{alert_id}/resolve` - resolve an alert
- `GET /api/admin/role-requests` - list governed accounts (admin only)
- `PATCH /api/admin/role-requests/{user_id}` - approve/reject a request (admin only)

Example hardware payload:

```json
{
  "readings": [
    {
      "animal_id": "uuid-from-animals-table",
      "sensor_type": "EC",
      "value": 4.8,
      "unit": "mS/cm",
      "device_id": "ESP32-BARN-A",
      "is_simulated": false
    },
    {
      "animal_id": "uuid-from-animals-table",
      "sensor_type": "TEMP",
      "value": 38.7,
      "unit": "C",
      "device_id": "ESP32-BARN-A",
      "is_simulated": false
    }
  ]
}
```

When `DEVICE_INGESTION_KEY` is configured, send it in the `X-Device-Key` header.

## Enable YCloud WhatsApp alerts

1. Apply `supabase/migrations/20260903120000_add_ycloud_whatsapp_alerts.sql`.
2. In YCloud, connect the WhatsApp Business Account and sender number, then
   create an English **UTILITY** template named `herdvitals_risk_alert_v1` with
   this body (keep the seven variables in this exact order):

```text
HerdVitals {{1}} risk alert
Cow: {{2}}
Breed: {{3}}
7-day prototype risk: {{4}}
Latest EC: {{5}}
Latest temperature: {{6}}
Preventive steps: {{7}}

This is an early-warning signal, not a diagnosis. Confirm clinically and contact a veterinarian.
```

3. Wait until Meta marks the template `APPROVED`. Add the YCloud values shown
   in `.env.example` to the backend environment and redeploy/restart it.
4. Create a YCloud webhook endpoint for `whatsapp.message.updated` pointing to
   `https://YOUR-BACKEND/api/webhooks/ycloud`. Store its signing secret as
   `YCLOUD_WEBHOOK_SECRET`.
5. Each intended recipient opens **Profile**, confirms an E.164 WhatsApp number,
   enables **Send me WhatsApp risk alerts**, and saves.
6. Send a physical-device batch to `POST /api/readings`. Each affected cow is
   recomputed. Only a live `HIGH` or `MODERATE` result is sent. Accepted sends
   suppress that cow/recipient pair for a rolling 24 hours; if the risk remains
   elevated after that period, the next real batch sends the reminder.

Recipients are currently application-wide because this prototype has no farm
or cow ownership mapping. Add farm membership/animal ownership before using it
across unrelated organizations. Set `WHATSAPP_ALERT_ROLES` to narrow delivery
by active role if needed.

## Verification

```powershell
cd backend\herd-vitals-backend
venv\Scripts\python.exe -m unittest discover -s tests -v

cd ..\..\frontend
npm run lint
npm run build
```

## Vercel deployment

The GitHub repository is prepared for separate Vercel frontend and backend
projects. Follow [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md) for project roots,
environment variables, Supabase Auth URLs, and post-deployment checks.

## Research model benchmark

The current dashboard continues to use the stable prototype model. A separate
scientific pipeline is available for building a genuine future-event model once
confirmed mastitis events are collected:

```powershell
cd backend\herd-vitals-backend
venv\Scripts\python.exe -m app.ml.train --output ..\..\ml\reports\synthetic_event_benchmark.json
```

This benchmark generates events first and derives pre-event sensor trajectories
afterward. Its positive target is a first clinical onset 7 through 14 days in
the future; observations closer than seven days to onset are excluded. It
verifies label timing, feature construction and model comparison;
it is deliberately marked synthetic and not clinically validated. Dataset
provenance and restrictions are recorded in `ml/datasets/README.md`.

The versioned migration in `supabase/migrations/` adds confirmed mastitis
events, devices, model provenance, reading-quality metadata and explicit
prediction states. Apply it to a linked Supabase development project only after
reviewing it; the existing demo does not require this migration to keep working.

## Next milestone

The next full-prototype phase is to apply the migration in a development
environment, expose validated mastitis-event entry through FastAPI, add the
first licensed real-dataset adapter, and run animal/farm-aware temporal
validation. Measured SCC/CMT, multilingual/offline workflows, ESP32 telemetry
and notification delivery remain product milestones.

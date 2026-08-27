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

The API and Swagger documentation run at `http://127.0.0.1:8000` and `http://127.0.0.1:8000/docs`.

## Run the frontend

```powershell
cd frontend
npm install
npm run dev
```

Copy `frontend/.env.example` to `frontend/.env` and set:

- `VITE_API_URL=http://127.0.0.1:8000`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (the public browser key, never the service-role key)

## Enable authentication and RBAC

1. Apply the migrations in `supabase/migrations/` in timestamp order in the
   Supabase SQL editor. The two `add_admin_*` migrations must be run separately
   and in order because PostgreSQL commits new enum values between migrations.
2. In Supabase, open **Authentication > Hooks > Custom Access Token** and
   select `public.custom_access_token_hook`.
3. Create normal accounts through `/register`. Dairy farmers are activated
   automatically after Auth signup/email confirmation. Veterinarians, dairy
   cooperatives, and animal-health authorities enter the admin waiting list.
4. In **Authentication > Users > Add user**, create `njeevan260@gmail.com` and
   set its password. Do not insert passwords directly into `auth.users`.
5. Run `supabase/bootstrap_admin.sql` in the SQL editor to assign the protected
   `ADMIN` role to that existing Auth user.
6. Sign in as the admin and use `/portal/admin` to approve or reject waiting
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

## Verification

```powershell
cd backend\herd-vitals-backend
venv\Scripts\python.exe -m unittest discover -s tests -v

cd ..\..\frontend
npm run lint
npm run build
```

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

# HerdVitals - SIH 26109 Prototype

HerdVitals is an AI/IoT prototype for early bovine mastitis risk monitoring. The current build includes a React dashboard, FastAPI backend, Supabase data layer, a validated sensor-ingestion contract, animal and herd risk views, alerts, GIS visualization, and a persisted prototype Random Forest model.

## Current prototype status

- Supabase connection: working
- Dashboard and GIS APIs: working against the current schema
- Sensor data: 14,400 simulated EC and temperature readings
- Model: persisted Random Forest prototype trained on simulated threshold labels
- Prediction preview: read-only `GET`; opening pages does not add database rows
- Prediction recomputation: explicit `POST`; saves one prediction and may create a deduplicated high-risk alert
- Hardware ingestion: validated EC/TEMP batch endpoint
- Clinical validation: not completed

The model output must be described as a prototype risk signal, not a veterinary diagnosis or a clinically validated 7-14 day forecast.

## Run the backend

```powershell
cd backend\herd-vitals-backend
copy .env.example .env
venv\Scripts\python.exe main.py
```

Required backend environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_KEY`
- `DEVICE_INGESTION_KEY` for authenticated hardware ingestion

The API and Swagger documentation run at `http://127.0.0.1:8000` and `http://127.0.0.1:8000/docs`.

## Run the frontend

```powershell
cd frontend
npm install
npm run dev
```

Set `VITE_API_URL=http://127.0.0.1:8000` if the backend is not using the default URL.

## Important API flows

- `GET /api/dashboard/summary` - herd KPIs and history
- `GET /api/predict/{animal_id}` - compute a preview without database writes
- `POST /api/predict/{animal_id}` - explicitly recompute and persist risk
- `GET /api/model/status` - model mode, training time and validation disclosure
- `POST /api/model/train` - start background prototype training
- `POST /api/readings` - ingest a validated hardware batch
- `PATCH /api/alerts/{alert_id}/resolve` - resolve an alert

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

## Next milestone

The next full-prototype phase is to add versioned Supabase migrations and authorization, measured SCC/CMT and farm-context inputs, multilingual/offline workflows, a real ESP32 telemetry demonstration, notification delivery, and animal/farm-aware temporal model validation.

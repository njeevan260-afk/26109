from datetime import datetime
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router
from app.api.model import train_in_background
from app.core.database import supabase
from app.services.ml_service import risk_model

load_dotenv()

app = FastAPI(
    title="HerdVitals API",
    description="AI-powered bovine mastitis early warning system",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/")
def root():
    return {
        "status": "online",
        "message": "HerdVitals FastAPI backend is running",
        "service": "HerdVitals",
        "version": "1.0.0",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "HerdVitals API",
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/api/test-connection")
@app.get("/api/test-supabase")
@app.get("/test-supabase")
def test_connection():
    try:
        rows = supabase.table("animals").select("id").limit(1).execute()
        return {
            "status": "connected",
            "message": "FastAPI successfully connected to Supabase",
            "rows_found": len(rows.data or []),
            "supabase_url_configured": bool(os.getenv("SUPABASE_URL")),
        }
    except Exception as exc:
        return {
            "status": "error",
            "message": str(exc),
        }


@app.on_event("startup")
async def startup_event():
    print("=" * 60)
    print("HerdVitals FastAPI Backend")
    print("=" * 60)
    print("GET  /api/test-supabase")
    print("POST /api/simulate")
    print("POST /api/predict/{animal_id}")
    print("GET  /api/dashboard/summary")
    print("GET  /api/alerts")
    print("GET  /api/model/status")
    print("=" * 60)
    if not risk_model.is_trained:
        train_in_background()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
    )

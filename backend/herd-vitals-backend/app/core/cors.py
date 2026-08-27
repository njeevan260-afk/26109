import os


LOCAL_DEVELOPMENT_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
)


def get_cors_origins(configured_origins: str | None = None) -> list[str]:
    """Combine local origins with a comma-separated production allowlist."""
    raw_origins = (
        os.getenv("CORS_ORIGINS", "")
        if configured_origins is None
        else configured_origins
    )
    origins = [*LOCAL_DEVELOPMENT_ORIGINS]
    origins.extend(
        origin.strip().rstrip("/")
        for origin in raw_origins.split(",")
        if origin.strip()
    )
    return list(dict.fromkeys(origins))

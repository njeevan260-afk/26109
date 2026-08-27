import os

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_BACKEND_KEY = (
    os.getenv("SUPABASE_SECRET_KEY")
    or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_KEY")
)

if not SUPABASE_URL:
    raise ValueError("SUPABASE_URL is missing from .env")

if not SUPABASE_BACKEND_KEY:
    raise ValueError(
        "SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is missing from .env"
    )

supabase = create_client(
    SUPABASE_URL,
    SUPABASE_BACKEND_KEY,
)

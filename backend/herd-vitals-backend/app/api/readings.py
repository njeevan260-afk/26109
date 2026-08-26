from fastapi import APIRouter

router = APIRouter()

@router.post("/readings")
async def placeholder_readings():
    return {"message": "Readings endpoint - coming soon"}
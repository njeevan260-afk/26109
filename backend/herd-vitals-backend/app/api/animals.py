from fastapi import APIRouter, HTTPException
from app.core.database import supabase

router = APIRouter()


@router.get("/animals")
async def get_animals():
    try:
        response = (
            supabase
            .table("animals")
            .select("*")
            .order("tag_number")
            .execute()
        )
        return response.data or []
    except Exception as e:
        print(f"❌ Error fetching animals: {e}")
        try:
            response = supabase.table("animals").select("*").execute()
            return response.data or []
        except Exception:
            raise HTTPException(status_code=500, detail=str(e))


@router.get("/animals/{animal_id}")
async def get_animal(animal_id: str):
    try:
        by_id = (
            supabase.table("animals").select("*").eq("id", animal_id).limit(1).execute()
        )
        if by_id.data:
            return by_id.data[0]
        by_tag = (
            supabase.table("animals").select("*").eq("tag_number", animal_id).limit(1).execute()
        )
        if by_tag.data:
            return by_tag.data[0]
        raise HTTPException(status_code=404, detail="Animal not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
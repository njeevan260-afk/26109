import logging
import threading

from fastapi import APIRouter, Depends

from app.core.auth import AuthPrincipal, require_permissions
from app.services.ml_service import risk_model

router = APIRouter()
logger = logging.getLogger(__name__)
_training_lock = threading.Lock()
_training = False


def train_in_background():
    global _training
    if not _training_lock.acquire(blocking=False):
        return False
    _training = True

    def run():
        global _training
        try:
            risk_model.train_model()
        except Exception as exc:
            logger.exception("Background model training failed: %s", exc)
        finally:
            _training = False
            _training_lock.release()

    threading.Thread(target=run, daemon=True, name="mastitis-model-training").start()
    return True


@router.get("/model/status")
async def model_status():
    return {**risk_model.status(), "training": _training}


@router.post("/model/train", status_code=202)
async def train_model(
    _principal: AuthPrincipal = Depends(require_permissions("model.manage")),
):
    started = train_in_background()
    return {
        "status": "started" if started else "already_running",
        **risk_model.status(),
        "training": True,
    }

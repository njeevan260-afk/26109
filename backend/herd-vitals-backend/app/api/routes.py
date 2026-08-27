from fastapi import APIRouter, Depends

from app.api import (
    alerts,
    admin,
    animals,
    auth,
    clusters,
    dashboard,
    hardware,
    mastitis_events,
    model,
    predictions,
    readings,
    sensors,
    simulate,
)
from app.core.auth import require_active_user, require_permissions

router = APIRouter()

router.include_router(auth.router, prefix="/api", tags=["Authentication"])
router.include_router(admin.router, prefix="/api", tags=["Administration"])
router.include_router(readings.router, prefix="/api", tags=["Readings"])
router.include_router(
    predictions.router,
    prefix="/api",
    tags=["Predictions"],
    dependencies=[Depends(require_permissions("predictions.read"))],
)
router.include_router(
    animals.router,
    prefix="/api",
    tags=["Animals"],
    dependencies=[Depends(require_permissions("animals.read"))],
)
router.include_router(
    simulate.router,
    prefix="/api",
    tags=["Simulate"],
    dependencies=[Depends(require_permissions("simulation.manage"))],
)
router.include_router(
    alerts.router,
    prefix="/api",
    tags=["Alerts"],
    dependencies=[Depends(require_permissions("alerts.read"))],
)
router.include_router(
    dashboard.router,
    prefix="/api",
    tags=["Dashboard"],
    dependencies=[Depends(require_permissions("dashboard.read"))],
)
router.include_router(
    clusters.router,
    prefix="/api",
    tags=["Clusters"],
    dependencies=[Depends(require_permissions("clusters.read"))],
)
router.include_router(hardware.router, prefix="/api", tags=["Hardware"])
router.include_router(
    sensors.router,
    prefix="/api",
    tags=["Sensors"],
    dependencies=[Depends(require_active_user)],
)
router.include_router(
    model.router,
    prefix="/api",
    tags=["Model"],
    dependencies=[Depends(require_active_user)],
)
router.include_router(
    mastitis_events.router,
    prefix="/api",
    tags=["Mastitis Events"],
    dependencies=[Depends(require_permissions("events.read"))],
)

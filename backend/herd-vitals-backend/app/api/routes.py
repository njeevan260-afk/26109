from fastapi import APIRouter

from app.api import (
    alerts,
    animals,
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

router = APIRouter()

router.include_router(readings.router, prefix="/api", tags=["Readings"])
router.include_router(predictions.router, prefix="/api", tags=["Predictions"])
router.include_router(animals.router, prefix="/api", tags=["Animals"])
router.include_router(simulate.router, prefix="/api", tags=["Simulate"])
router.include_router(alerts.router, prefix="/api", tags=["Alerts"])
router.include_router(dashboard.router, prefix="/api", tags=["Dashboard"])
router.include_router(clusters.router, prefix="/api", tags=["Clusters"])
router.include_router(hardware.router, prefix="/api", tags=["Hardware"])
router.include_router(sensors.router, prefix="/api", tags=["Sensors"])
router.include_router(model.router, prefix="/api", tags=["Model"])
router.include_router(
    mastitis_events.router,
    prefix="/api",
    tags=["Mastitis Events"],
)

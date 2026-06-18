"""Feature 2 routes — Geospatial data for dual heatmap."""

from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/f2", tags=["Feature 2"])

service = None


def set_service(svc):
    global service
    service = svc


@router.get("/heatmap")
def get_heatmap(hour: int | None = Query(default=None, ge=0, le=23)):
    return service.get_heatmap(hour)


@router.get("/zones")
def get_zone_circles():
    return service.get_zone_circles()


@router.get("/hourly")
def get_hourly():
    return service.get_hourly()

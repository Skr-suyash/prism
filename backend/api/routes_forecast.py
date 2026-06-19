"""Feature routes — Hourly Violation Forecasting."""

from fastapi import APIRouter

router = APIRouter(prefix="/api/f7", tags=["Feature 7 - Forecast"])

service = None


def set_service(svc):
    global service
    service = svc


@router.get("/summary")
def get_summary():
    return service.get_summary()


@router.get("/heatmap")
def get_heatmap():
    return service.get_heatmap()


@router.get("/dispatch")
def get_dispatch():
    return service.get_dispatch()


@router.get("/hourly-totals")
def get_hourly_totals():
    return service.get_hourly_totals()


@router.get("/station/{station}")
def get_station_forecast(station: str):
    return service.get_station_forecast(station)

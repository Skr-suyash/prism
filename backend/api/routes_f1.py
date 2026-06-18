"""Feature 1 routes — Zone rankings, rank flip, real-time scoring."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/f1", tags=["Feature 1"])

service = None


def set_service(svc):
    global service
    service = svc


class ViolationInput(BaseModel):
    hour: int
    day_of_week: int
    police_station: str
    center_code: int = -1
    vehicle_type: str = "UNKNOWN"
    violation_type: str = "UNKNOWN"
    junction_name: str = "No Junction"
    latitude: float = 12.9716
    longitude: float = 77.5946


@router.get("/zones")
def get_zones():
    return service.get_zones()


@router.get("/rank-flip")
def get_rank_flip(top_n: int = 10):
    return service.get_rank_flip(top_n)


@router.get("/metrics")
def get_metrics():
    return service.get_metrics()


@router.post("/score")
def score_violation(payload: ViolationInput):
    try:
        return service.score_single(payload.model_dump())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

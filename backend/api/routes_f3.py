"""Feature 3 routes — Enforcement Blindspot Audit (Isolation Forest)."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v1/audit", tags=["Feature 3 — Blindspot Audit"])

service = None


def set_service(svc):
    global service
    service = svc


class BucketInput(BaseModel):
    """Payload for scoring a single operational bucket."""
    sync_rate: float = Field(..., ge=0, le=1, description="Data delivery success rate (0-1)")
    rejection_rate: float = Field(..., ge=0, le=1, description="Data quality failure rate (0-1)")
    duplicate_rate: float = Field(..., ge=0, le=1, description="Duplicate submission rate (0-1)")
    volume: int = Field(..., gt=0, description="Number of records in this bucket")


@router.get("/quadrant")
def get_quadrant():
    """Return precomputed blindspot quadrant data for all operational buckets."""
    if service is None:
        raise HTTPException(status_code=503, detail="Audit service not initialized")
    return service.get_quadrant()


@router.post("/infer")
def infer_bucket(payload: BucketInput):
    """Score a new operational bucket against the Isolation Forest model."""
    if service is None:
        raise HTTPException(status_code=503, detail="Audit service not initialized")
    try:
        return service.infer_new_bucket(
            sync_rate=payload.sync_rate,
            rejection_rate=payload.rejection_rate,
            duplicate_rate=payload.duplicate_rate,
            volume=payload.volume,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

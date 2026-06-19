"""Feature 5 routes — Repeat Offender Network."""

from fastapi import APIRouter

router = APIRouter(prefix="/api/f5", tags=["Feature 5"])

service = None

def set_service(svc):
    global service
    service = svc

@router.get("/clusters")
def get_clusters():
    return service.get_clusters()

@router.get("/offenders")
def get_offenders():
    return service.get_offenders()

@router.get("/hubs")
def get_hubs():
    return service.get_hubs()

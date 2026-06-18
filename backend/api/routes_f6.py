"""Feature 6 routes — Enforcement Shift Recommender."""

from fastapi import APIRouter

router = APIRouter(prefix="/api/f6", tags=["Feature 6"])

service = None


def set_service(svc):
    global service
    service = svc


@router.get("/matrix")
def get_matrix():
    return service.get_matrix()


@router.get("/allocate")
def allocate(officers: int = 20, max_per_cell: int = 3):
    return service.allocate(officers, max_per_cell)

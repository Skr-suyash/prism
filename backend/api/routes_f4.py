"""Feature 4 routes — Vehicle Type Misclassification Pattern."""

from fastapi import APIRouter

router = APIRouter(prefix="/api/f4", tags=["Feature 4"])

service = None


def set_service(svc):
    global service
    service = svc


@router.get("/summary")
def get_summary():
    return service.get_summary()


@router.get("/confusion-matrix")
def get_confusion_matrix():
    return service.get_confusion_matrix()


@router.get("/temporal")
def get_temporal():
    return service.get_temporal()


@router.get("/stations")
def get_stations():
    return service.get_stations()

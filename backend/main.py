"""
GridLock — FastAPI Backend Entrypoint.

Startup sequence:
  1. Load XGBoost model + preprocessing artifacts
  2. Load raw dataset → preprocess → score all records
  3. Cache zone aggregations, heatmap sample, hourly distribution
  4. Serve via REST endpoints
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api import routes_f1, routes_f2, routes_f4
from backend.services.priority_service import PriorityService
from backend.services.misclassification_service import MisclassificationService


@asynccontextmanager
async def lifespan(app: FastAPI):
    svc = PriorityService()
    svc.initialize()
    routes_f1.set_service(svc)
    routes_f2.set_service(svc)
    
    misc_svc = MisclassificationService()
    misc_svc.initialize(svc.df)
    routes_f4.set_service(misc_svc)
    yield


app = FastAPI(title="GridLock API", version="2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes_f1.router)
app.include_router(routes_f2.router)
app.include_router(routes_f4.router)


@app.get("/health")
def health():
    return {"status": "ok"}

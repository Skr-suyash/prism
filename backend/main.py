"""
GridLock — FastAPI Backend Entrypoint.

Startup sequence:
  1. Load XGBoost model (for real-time scoring)
  2. Load pre-computed JSON caches (instant)
  3. Serve via REST endpoints

If cache files are missing, falls back to full compute (slow).
Run `python precompute.py` to generate/refresh the cache.
"""

import subprocess
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

from backend.api import routes_f1, routes_f2, routes_f3, routes_f4, routes_f5, routes_f6, routes_forecast
from backend.services.priority_service import PriorityService
from backend.services.misclassification_service import MisclassificationService
from backend.services.network_service import NetworkService
from backend.services.audit_service import AuditService
from backend.services.enforcement_service import EnforcementService
from backend.services.forecast_service import ForecastService

# Global service references for recompute endpoint
_priority_svc: PriorityService | None = None
_misclass_svc: MisclassificationService | None = None
_network_svc: NetworkService | None = None
_audit_svc: AuditService | None = None
_enforcement_svc: EnforcementService | None = None
_forecast_svc: ForecastService | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _priority_svc, _misclass_svc, _network_svc, _audit_svc, _enforcement_svc

    svc = PriorityService()
    svc.initialize()
    routes_f1.set_service(svc)
    routes_f2.set_service(svc)
    _priority_svc = svc

    misc_svc = MisclassificationService()
    misc_svc.initialize()  # No df needed if cache exists
    routes_f4.set_service(misc_svc)
    _misclass_svc = misc_svc

    net_svc = NetworkService()
    net_svc.initialize()  # No df needed if cache exists
    routes_f5.set_service(net_svc)
    _network_svc = net_svc

    audit_svc = AuditService()
    audit_svc.initialize()  # Loads from cache or precomputes
    routes_f3.set_service(audit_svc)
    _audit_svc = audit_svc

    enf_svc = EnforcementService()
    enf_svc.initialize()
    routes_f6.set_service(enf_svc)
    _enforcement_svc = enf_svc

    forecast_svc = ForecastService()
    forecast_svc.initialize()
    routes_forecast.set_service(forecast_svc)
    _forecast_svc = forecast_svc
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
app.include_router(routes_f3.router)
app.include_router(routes_f4.router)
app.include_router(routes_f5.router)
app.include_router(routes_f6.router)
app.include_router(routes_forecast.router)


@app.get("/health")
def health():
    return {"status": "ok"}


def _run_precompute():
    """Run the precompute script as a subprocess, then reload caches."""
    import os
    script = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "precompute.py")
    subprocess.run([sys.executable, script], check=True)

    # Reload all services from the fresh cache
    if _priority_svc:
        _priority_svc.initialize()
    if _misclass_svc:
        _misclass_svc.initialize()
    if _network_svc:
        _network_svc.initialize()
    if _audit_svc:
        _audit_svc.initialize()
    if _enforcement_svc:
        _enforcement_svc.initialize()


@app.post("/admin/recompute")
def recompute(background_tasks: BackgroundTasks):
    """Trigger a full recompute of all analytics caches.
    
    Runs in the background so the API stays responsive.
    """
    background_tasks.add_task(_run_precompute)
    return {
        "status": "recompute_started",
        "message": "The precompute pipeline is running in the background. All caches will be refreshed automatically."
    }

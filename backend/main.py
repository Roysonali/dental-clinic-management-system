from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.modules.auth.routes import router as auth_router
from app.modules.users.routes import (router as users_router)

from app.modules.patients.routes import (router as patient_router)
from app.modules.appointments.router import (router as appointment_router)
from app.modules.patient_records.routers.patient_record_router import (
    router as patient_record_router,
)
from app.modules.patient_records.routers.diagnosis_router import (
    router as diagnosis_router,
    item_router as diagnosis_item_router,
)
from app.modules.patient_records.routers.prescription_router import (
    router as prescription_router,
    item_router as prescription_item_router,
)
from app.modules.patient_records.routers.prescription_item_router import (
    router as rx_item_router,
    item_router as rx_item_detail_router,
)
from app.modules.patient_records.routers.attachment_router import (
    router as attachment_router,
    item_router as attachment_item_router,
)
from app.modules.patient_records.routers.followup_router import (
    router as followup_router,
    item_router as followup_item_router,
)
from app.modules.patient_records.routers.audit_router import (
    router as audit_router,
    item_router as audit_item_router,
)
from app.modules.doctors.routes import (
    router as doctor_router,
    specialization_router,
    schedule_router,
)
from app.modules.treatment.routers import (
    procedure_router,
    treatment_plan_router,
)
from app.modules.billing.routers import billing_router
from app.core.exception_handlers import (register_exception_handlers)
import os

app = FastAPI(
    title="DensCare API",
    version="1.0.0"
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router( patient_router)
app.include_router(appointment_router)
app.include_router(patient_record_router)
app.include_router(diagnosis_router)
app.include_router(diagnosis_item_router)
app.include_router(prescription_router)
app.include_router(prescription_item_router)
app.include_router(rx_item_router)
app.include_router(rx_item_detail_router)
app.include_router(attachment_router)
app.include_router(attachment_item_router)
app.include_router(followup_router)
app.include_router(followup_item_router)
app.include_router(audit_router)
app.include_router(audit_item_router)
app.include_router(doctor_router)
app.include_router(specialization_router)
app.include_router(schedule_router)
app.include_router(procedure_router)
app.include_router(treatment_plan_router)
app.include_router(billing_router)

# Register global exception handlers
register_exception_handlers(app)

# CORS configuration
#
# The frontend dev server (Vite) can be opened via either `localhost` or
# `127.0.0.1`; the Origin header the browser sends depends on which hostname
# was typed into the address bar. The frontend API client
# (frontend/src/services/api.ts) targets `http://127.0.0.1:8000`, so BOTH
# dev-server origins must be allow-listed. Without `http://127.0.0.1:5173`,
# opening the app at http://127.0.0.1:5173 makes every browser request a
# cross-origin request whose Origin is not allow-listed → the browser blocks
# the response with "Access to XMLHttpRequest ... blocked by CORS".


frontend_urls = os.getenv("FRONTEND_URLS", "")
allowed_origins = [url.strip() for url in frontend_urls.split(",") if url.strip()]

allowed_origins += [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],

)


@app.get("/")
def root():
    return {"message": "DensCare Backend Running"}
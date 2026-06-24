from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.modules.auth.routes import router as auth_router
from app.modules.users.routes import (router as users_router)

from app.modules.patients.routes import (router as patient_router)
from app.modules.appointments.router import (router as appointment_router)
from app.core.exception_handlers import (register_exception_handlers)

app = FastAPI(
    title="DensCare API",
    version="1.0.0"
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router( patient_router)
app.include_router(appointment_router)

# Register global exception handlers
register_exception_handlers(app)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],

)


@app.get("/")
def root():
    return {"message": "DensCare Backend Running"}
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.modules.auth.routes import router as auth_router
from app.modules.users.routes import (
    router as users_router
)

app = FastAPI(
    title="DensCare API",
    version="1.0.0"
)

app.include_router(auth_router)
app.include_router(users_router)

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
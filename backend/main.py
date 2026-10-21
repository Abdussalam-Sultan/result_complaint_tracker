import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.database import engine, Base
from backend.routes import (
    auth, courses, complaints, items, groups,
    notifications, stats, admin
)

@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(
    title="OAU Student Result Complaint Tracker API",
    description="Backend API for managing result complaints, mass issues clustering, and HOD escalations at Obafemi Awolowo University (OAU).",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploads static directory
upload_dir = complaints.UPLOAD_DIR
os.makedirs(upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")

# Include Routers
app.include_router(auth.router)
app.include_router(courses.router)
app.include_router(complaints.router)
app.include_router(items.router)
app.include_router(groups.router)
app.include_router(notifications.router)
app.include_router(stats.router)
app.include_router(admin.router)

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app": "OAU Student Result Complaint Tracker",
        "institution": "Obafemi Awolowo University, Ile-Ife",
        "department": "Computer Science & Engineering"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import redis.asyncio as redis
from fastapi_limiter import FastAPILimiter
from dotenv import load_dotenv

from core.config import settings
from api.routes import router as api_router

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    raw_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    environment = os.getenv("ENVIRONMENT", "development")
    
    # THE ULTIMATE FIX: Intercept Upstash's bad URL string and translate it 
    # to what redis-py actually understands.
    if environment == "development":
        # Local Windows: change it to "none" to bypass local certificate checks
        safe_url = raw_url.replace("CERT_REQUIRED", "none")
    else:
        # Production: change it to "required" so it locks down securely
        safe_url = raw_url.replace("CERT_REQUIRED", "required")
        
    redis_connection = redis.from_url(
        safe_url, 
        encoding="utf-8", 
        decode_responses=True
    )
    
    await FastAPILimiter.init(redis_connection)
    yield
    await redis_connection.close()

# Initialize the FastAPI application EXACTLY ONCE
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for PDF Utility Platform",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://dammpdf.vercel.app"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# STATIC FILES CONFIGURATION
# Ensure the directory exists so FastAPI doesn't crash on startup
os.makedirs("processed_files", exist_ok=True)

# Mount the directory to the /download URL path
app.mount("/download", StaticFiles(directory="processed_files"), name="download")
# ==========================================

# Register your routes
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def read_root():
    return {
        "status": "online", 
        "message": "DammPDF Utility API is running smoothly!"
    }
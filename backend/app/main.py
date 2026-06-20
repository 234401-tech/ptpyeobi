from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="여비뚝딱 API",
    description="출장 여비정산 자동화 — 경북AI혁신본부",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "여비뚝딱", "ocr_provider": settings.ocr_provider}


from app.routers import calculate, opinet, trips, uploads  # noqa: E402

app.include_router(calculate.router)
app.include_router(trips.router)
app.include_router(opinet.router)
app.include_router(uploads.router)

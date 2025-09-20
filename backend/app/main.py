from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import ingest, retrieve, translate

app = FastAPI(title="UX Writer Assistant Backend (Lab)", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router, prefix="/v1")
app.include_router(retrieve.router, prefix="/v1")
app.include_router(translate.router, prefix="/v1")

@app.get("/health")
def health():
    return {"status": "ok"}

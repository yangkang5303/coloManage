from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import ai, auth, crud, documents, search, workflows
from app.core.config import get_settings
from app.db.session import Base, engine


Base.metadata.create_all(bind=engine)

settings = get_settings()
app = FastAPI(title="Colo Contract Execution Intelligence MVP")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(crud.router)
app.include_router(documents.router)
app.include_router(search.router)
app.include_router(ai.router)
app.include_router(workflows.router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/")
def root():
    return {
        "name": "Colo Contract Execution Intelligence MVP",
        "status": "ok",
        "docs": "/docs",
        "health": "/health",
        "frontend": "http://localhost:3000",
    }

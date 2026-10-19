from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.routes import router
from app.core.config import settings
from app.db.session import engine
from app.db.seed import seed_database, ensure_role_accounts
from app.models import entities  # noqa: F401
from app.db.base import Base
from app.db.session import SessionLocal

app = FastAPI(title=settings.app_name, version="2.0.0", description="DBMS-focused multi-warehouse inventory and order management API")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(router, prefix="/api")


@app.on_event("startup")
def startup():
    # Demo convenience: schema bootstrap is explicit and idempotent.
    # For a production deployment, use the checked-in SQL migration before starting the API.
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db)
        ensure_role_accounts(db)
    finally:
        db.close()

import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()


def normalize_database_url(url: str | None) -> str:
    """Normalize database connection URLs for SQLAlchemy 2.0 with psycopg v3.

    Render and legacy database services emit 'postgres://' or 'postgresql://'.
    SQLAlchemy 2.0 requires 'postgresql+psycopg://' when using psycopg 3.
    """
    if not url:
        return ""
    clean = url.strip()
    if clean.startswith("postgres://"):
        return clean.replace("postgres://", "postgresql+psycopg://", 1)
    if clean.startswith("postgresql://") and not clean.startswith("postgresql+"):
        return clean.replace("postgresql://", "postgresql+psycopg://", 1)
    return clean


RAW_DATABASE_URL = os.getenv("DATABASE_URL")

if not RAW_DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set")

DATABASE_URL = normalize_database_url(RAW_DATABASE_URL)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    future=True,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

# SQLite는 기본적으로 단일 스레드 체크 → FastAPI 멀티스레드 허용
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
    echo=False,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """모든 테이블 생성. Phase 2에서 models 임포트 후 호출."""
    # 모델 등록을 위해 임포트 (Phase 2에서 models.py 추가되면 활성화)
    try:
        from app import models  # noqa: F401
    except ImportError:
        pass
    Base.metadata.create_all(bind=engine)

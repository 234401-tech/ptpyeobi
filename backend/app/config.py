from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app/config.py → 프로젝트 루트 = parents[2]
ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    database_url: str = f"sqlite:///{DATA_DIR / '여비뚝딱.db'}"
    upload_dir: str = str(DATA_DIR / "uploads")
    cors_origins: str = "http://localhost:5173"

    opinet_api_key: str = ""
    opinet_prodcd: str = "B027"

    ocr_provider: str = "mock"
    upstage_api_key: str = ""
    clova_api_key: str = ""
    clova_invoke_url: str = ""
    anthropic_api_key: str = ""

    # 인증 — JWT 서명 시크릿. 운영 시 무작위 긴 문자열로 변경 권장.
    jwt_secret: str = "여비뚝딱-dev-secret-please-change-in-prod"
    # 초기 관리자 — seed 가 1회만 등록 (이미 user 가 있으면 무시).
    admin_username: str = "admin"
    admin_password: str = "changeme!2026"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()

# 데이터 폴더 보장
DATA_DIR.mkdir(parents=True, exist_ok=True)
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)

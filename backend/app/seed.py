"""초기 데이터 시드 — 출장대장 5건 + 오파넷 유가 14일치.

실행:  python -m app.seed         (기존 데이터 있으면 건너뜀)
       python -m app.seed --force (전부 지우고 다시 채움)
"""

from __future__ import annotations

import sys
from datetime import date

from app.auth import hash_password
from app.config import settings
from app.db import SessionLocal, init_db
from app.models import BizSystem, FuelPrice, Trip, User

# ── 사업명 → 회계시스템 기본 매핑 (CMS 에서 추가/수정 가능) ──
SEED_BIZ_SYSTEMS = [
    ("재단운영비", "통장", 10),
    ("초거대AI 클라우드팜", "e나라", 20),
    ("신재생 융복합", "RCMS", 30),
    ("동해안방사능", "보탬e", 40),
    ("에너지 행사지원", "지방비", 50),
]

# ── 출장대장 초기 5건 (디자인 미리보기 ledger 기준) ──
SEED_TRIPS = [
    dict(no=146, traveler_name="신재천", dept="신재생에너지팀",
         trip_date=date(2026, 5, 18), days=1, place="영주", mode="self_drive",
         title="(05.18/영주) 신재생 융복합 모니터링", biz_name="신재생(영주)",
         fund_system="RCMS", total=38_120, fund_date=date(2026, 6, 23)),
    dict(no=145, traveler_name="박수영", dept="AI융합산업팀",
         trip_date=date(2026, 5, 15), days=1, place="안동", mode="self_drive",
         title="(05.15/안동) CES2026 업무회의", biz_name="재단운영비",
         fund_system="통장", total=64_210, fund_date=date(2026, 6, 23)),
    dict(no=144, traveler_name="김승모", dept="AI융합산업팀",
         trip_date=date(2026, 4, 9), days=1, place="서울", mode="public_transit",
         title="(04.09/서울) NIA 서울사무소 회의", biz_name="재단운영비",
         fund_system="통장", total=107_500, fund_date=date(2026, 6, 16)),
    dict(no=143, traveler_name="김민수", dept="에너지인프라팀",
         trip_date=date(2026, 5, 14), days=1, place="영덕", mode="self_drive",
         title="(05.14/영덕) 종합지원센터 하자 점검", biz_name="재단운영비",
         fund_system="통장", total=26_840, fund_date=date(2026, 6, 16)),
    dict(no=142, traveler_name="박수영", dept="AI융합산업팀",
         trip_date=date(2026, 5, 12), days=1, place="경산", mode="self_drive",
         title="(05.12/경산) 디지털혁신 업무회의", biz_name="지역주도디지털혁신",
         fund_system="e나라", total=74_620, fund_date=date(2026, 6, 9)),
]

# ── 오파넷 보통휘발유 평균가 14일치 (디자인 미리보기 mock 기준) ──
SEED_FUEL = [
    (date(2026, 5, 27), "수", 2058),
    (date(2026, 5, 26), "화", 2061),
    (date(2026, 5, 25), "월", 2063),
    (date(2026, 5, 24), "일", 2062),
    (date(2026, 5, 23), "토", 2062),
    (date(2026, 5, 22), "금", 2063),
    (date(2026, 5, 21), "목", 2063),
    (date(2026, 5, 20), "수", 2061),
    (date(2026, 5, 19), "화", 2060),
    (date(2026, 5, 18), "월", 2058),
    (date(2026, 5, 17), "일", 2059),
    (date(2026, 5, 16), "토", 2059),
    (date(2026, 5, 15), "금", 2062),
    (date(2026, 5, 14), "목", 2063),
]


def _seed_biz_systems(db) -> int:
    """biz_systems 테이블이 비어 있을 때만 초기 매핑 5건 입력."""
    if db.query(BizSystem).count() > 0:
        return 0
    for name, fund, order in SEED_BIZ_SYSTEMS:
        db.add(BizSystem(biz_name=name, fund_system=fund, sort_order=order))
    db.commit()
    return len(SEED_BIZ_SYSTEMS)


def _seed_admin(db) -> bool:
    """users 가 비어 있으면 .env 의 ADMIN_USERNAME/PASSWORD 로 초기 관리자 1명 등록."""
    if db.query(User).count() > 0:
        return False
    if not settings.admin_username or not settings.admin_password:
        print("[경고] ADMIN_USERNAME/PASSWORD 미설정 — 초기 관리자 등록 건너뜀.")
        return False
    db.add(User(
        username=settings.admin_username,
        password_hash=hash_password(settings.admin_password),
        role="admin",
        is_active=1,
    ))
    db.commit()
    print(f"초기 관리자 등록: {settings.admin_username} (.env 의 ADMIN_PASSWORD 로 로그인)")
    return True


def seed(force: bool = False) -> None:
    init_db()
    db = SessionLocal()
    try:
        # 관리자 시드는 force 와 무관 — 사용자 데이터 보존 (수동 추가된 계정 등)
        _seed_admin(db)
        # 사업명 매핑도 force 무관 — CMS 에서 수정한 내용 보존
        added = _seed_biz_systems(db)
        if added:
            print(f"사업명·시스템 매핑 초기 {added}건 등록.")

        existing = db.query(Trip).count()
        if existing and not force:
            print(f"이미 {existing}건의 출장 데이터가 있습니다. "
                  f"다시 채우려면 --force 옵션을 쓰세요.")
            return

        if force:
            db.query(Trip).delete()
            db.query(FuelPrice).delete()
            db.commit()
            print("기존 데이터 삭제 완료.")

        for t in SEED_TRIPS:
            db.add(Trip(status="확정", **t))
        for d, wd, price in SEED_FUEL:
            db.add(FuelPrice(date=d, weekday=wd, price=price))
        db.commit()
        print(f"시드 완료: 출장 {len(SEED_TRIPS)}건, 유가 {len(SEED_FUEL)}일치.")
    finally:
        db.close()


if __name__ == "__main__":
    seed(force="--force" in sys.argv)

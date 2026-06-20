# 여비뚝딱

> 출장자가 제출한 증빙서류를 업로드하면 AI가 자동으로 추출·계산해 출장대장에 정리하는 여비정산 자동화 도구.
> 경북AI혁신본부 여비담당자용.

---

## 0. 사용법

### 새 PC에 설치하기 (담당자용)

```
git clone https://github.com/234401-tech/ptpyeobi.git
cd ptpyeobi
install.bat       ← 한 번만 (Python·Node·OCR 모델·DB 시드 자동)
run.bat           ← 두 서버 실행 + 브라우저 자동 오픈
update.bat        ← GitHub 최신 코드 + 의존성 동기화
```

`install.bat` 실행 후 `backend\.env` 메모장으로 열어 `OPINET_API_KEY` 등을 입력하면 됩니다.

### Claude Code 로 개발하기

- **처음 만들 때**: "README.md 읽고 Phase 1부터 차례로 만들어줘"
- **이어서 작업할 때**: "README.md의 Phase X 작업해줘"
- **부분 확장**: "README.md 5.2의 OCR 어댑터 구현해줘"

각 Phase 끝날 때마다 멈추고 결과를 보고하도록 시키세요.

---

## 1. 전체 구조

```
여비뚝딱/
├── frontend/           Vite + React + Tailwind 정산 화면
├── backend/            FastAPI + SQLite API 서버
├── data/               (gitignore)
│   ├── 여비뚝딱.db     SQLite
│   └── uploads/        증빙 PDF·이미지 원본
└── README.md           이 문서
```

---

## 2. 기술 스택

### 프론트엔드
- Vite 5
- React 18 (함수형 + hooks, JavaScript — TS 아님)
- Tailwind CSS 3
- `lucide-react`

### 백엔드
- Python 3.11+
- FastAPI
- SQLAlchemy 2.0
- SQLite (단일 담당자 기준 충분 — 망분리 환경 친화적)
- httpx (오파넷 API 호출)
- openpyxl (XLSX export)
- OCR: 어댑터 패턴 (Upstage / Naver Clova / Claude Vision 중 추후 선택)

---

## 3. 도메인 — 여비지급규정 v2025.06.24

### 3.1 출장유형 4종 (별표1)

| 모드 | 유류비 | 일비 |
|---|---|---|
| `self_drive` 자가차량 운전 | 거리(km) × 유가(원/L) ÷ 11.97 (10원 절사) | 25,000 × 일수 |
| `self_passenger` 자가차량 동승 | 0 (운전자에게만 지급) | 25,000 × 일수 × **50%** |
| `company_car` 공용차량 | 0 (자동차운임 미지급) | 25,000 × 일수 × **50%** |
| `public_transit` 대중교통 | 영수증 실비 합계 | 25,000 × 일수 |

### 3.2 식비 (1일 기본 3식, 단가표)

| 식수 | 금액 |
|---|---|
| 0식 | 0 |
| 1식 | 8,330 |
| 2식 | 16,670 |
| 3식 | 25,000 |
| 4식 | 33,330 |
| 5식 | 41,670 |
| 5식 초과 | 41,670 + (n−5) × 8,333 |

회의·세미나에서 식사 제공받은 만큼 차감.

### 3.3 숙박비 (직원 기준)

| 지역 | 1박 상한 |
|---|---|
| 서울특별시 | 100,000원 |
| 광역시 | 80,000원 |
| 그 밖의 지역 | 70,000원 |

영수증 첨부 시 상한액 내 실비.

### 3.4 동승자
- 동승자는 교통비 미지급, 일비 50%
- 동승자도 각자 별도 정산 등록 필요

### 3.5 유류비 공식
```
유류비 = 거리(km) × 오파넷 보통휘발유 일자별 평균가(원/L) ÷ 11.97
       → 10원 단위 절사
```

### 3.6 사업명 → 회계시스템 매핑

| 사업명 | 시스템 |
|---|---|
| 재단운영비 | 통장 |
| 초거대AI 클라우드팜 | e나라 |
| 신재생 융복합 | RCMS |
| 동해안방사능 | 보탬e |
| 에너지 행사지원 | 지방비 |

---

## 4. 데이터 모델

### 4.1 SQLite 스키마

```sql
-- 출장 정산
CREATE TABLE trips (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  no              INTEGER UNIQUE,             -- 출장대장 번호
  traveler_name   TEXT NOT NULL,
  dept            TEXT,

  trip_date       DATE NOT NULL,
  depart_time     TEXT,                       -- "14:00"
  return_time     TEXT,                       -- "17:00"
  days            INTEGER NOT NULL DEFAULT 1,

  place           TEXT NOT NULL,
  distance_km     REAL,                       -- 카카오맵 자동

  mode            TEXT NOT NULL,              -- self_drive|self_passenger|company_car|public_transit
  companions      INTEGER DEFAULT 0,

  fuel_price      INTEGER,                    -- 오파넷 매칭 원/L
  fuel_cost       INTEGER DEFAULT 0,
  toll_sum        INTEGER DEFAULT 0,
  public_cost     INTEGER DEFAULT 0,

  meals_provided  INTEGER DEFAULT 0,
  meal_cost       INTEGER DEFAULT 0,

  per_diem        INTEGER DEFAULT 0,

  nights          INTEGER DEFAULT 0,
  region          TEXT,                       -- seoul|metro|other
  lodge_cost      INTEGER DEFAULT 0,

  total           INTEGER DEFAULT 0,

  title           TEXT NOT NULL,
  biz_name        TEXT,
  fund_system     TEXT,                       -- 통장|e나라|RCMS|보탬e|지방비

  status          TEXT DEFAULT '확정',         -- 작성중|확정|집행완료
  fund_date       DATE,                       -- 자금집행일

  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 대중교통 영수증
CREATE TABLE public_receipts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id         INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,
  amount          INTEGER NOT NULL,
  ocr_confidence  REAL,                       -- 0.0~1.0, OCR 신뢰도
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 오파넷 일자별 유가 (캐시)
CREATE TABLE fuel_prices (
  date            DATE PRIMARY KEY,           -- "2026-05-21"
  weekday         TEXT,
  price           INTEGER NOT NULL,
  fetched_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 증빙 첨부
CREATE TABLE attachments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id         INTEGER REFERENCES trips(id) ON DELETE CASCADE,
  filename        TEXT NOT NULL,
  file_path       TEXT NOT NULL,              -- data/uploads/...
  ocr_result_json TEXT,                       -- OCR 원본 결과 (디버깅용)
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 4.2 핵심 데이터 흐름

```
[증빙 PDF]
    │ POST /api/uploads
    ▼
[attachments] ── OCR ──▶ trips 후보값 + public_receipts 후보
    │                              │
    │   (담당자 확인·수정)            │
    ▼                              ▼
[POST /api/trips] ◀───────────────┘
    │
    ▼
[trips + public_receipts]
    │
    ▼ GET /api/trips/export
[XLSX 출력]
```

---

## 5. API 명세

### 5.1 증빙 업로드 & OCR

```
POST /api/uploads
  Content-Type: multipart/form-data
  Body: file (PDF | JPG | PNG)
  Response: { upload_id, filename, pages }

POST /api/uploads/{upload_id}/extract
  Response: {
    traveler, dept, trip_date,
    depart_time, return_time,
    place, distance_km,
    mode_suggested,
    public_receipts: [{ label, amount, confidence }, ...]
  }
```

### 5.2 OCR 어댑터 (`services/ocr/`)

```python
class OCRAdapter(Protocol):
    def extract_trip(self, file_path: str) -> TripExtraction: ...
    def extract_receipts(self, file_path: str) -> list[ReceiptExtraction]: ...
```

구현 후보:
- `services/ocr/upstage.py` — Upstage Document AI (한국어 강함)
- `services/ocr/clova.py` — Naver Clova OCR
- `services/ocr/claude_vision.py` — Claude Vision API (멀티모달)
- `services/ocr/local.py` — PaddleOCR / Tesseract (망분리 내부 LLM 사용 시)

어댑터는 환경변수 `OCR_PROVIDER`로 선택.

### 5.3 오파넷 유가 (캐시)

```
GET /api/opinet/prices?from=2026-05-14&to=2026-05-27
  Response: [{ date, weekday, price, delta }, ...]
  - fuel_prices 테이블 우선 조회
  - 누락된 날짜는 오파넷 API 호출 후 캐시 저장

GET /api/opinet/prices/{date}
  Response: { date, weekday, price }

POST /api/opinet/sync
  - 수동 동기화 (스케줄러 백업)
```

### 5.4 정산 계산 (서버 검증)

```
POST /api/calculate
  Body: { mode, days, distance_km, fuel_price, nights, region,
          meals_provided, public_receipts }
  Response: {
    fuel_cost, toll_sum, public_cost, meal_cost,
    per_diem, lodge_cost, total,
    breakdown: { ... },
    rules_applied: ["fuel:139km×2063÷11.97=23950", ...]
  }
```

프론트의 `lib/compute.js`와 서버의 `services/calculator.py`는 동일 결과를 내야 함 (회귀 테스트 필수).

### 5.5 출장 (저장 + 대장)

```
POST   /api/trips                 새 정산 저장
GET    /api/trips                 대장 조회
                                   ?q=검색어 &fund=통장 &month=2026-06
GET    /api/trips/{id}            단건 조회
PATCH  /api/trips/{id}            수정
DELETE /api/trips/{id}            삭제

GET    /api/trips/export          XLSX 다운로드
                                   (같은 필터 적용 가능)
                                   엑셀 `2026 국내②` 시트 형식 그대로
```

---

## 6. 폴더 구조 (목표)

```
여비뚝딱/
├── README.md
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       ├── lib/
│       │   ├── api.js              백엔드 호출 (fetch wrapper)
│       │   ├── constants.js        TRIP_MODES, REGION_RATES, mealAmount()
│       │   ├── compute.js          정산 계산 (백엔드와 동일 로직)
│       │   └── mockData.js         (개발 초반용 — Phase 4 후 제거)
│       ├── hooks/
│       │   └── useTravelExpense.js
│       └── components/
│           ├── Header.jsx
│           ├── UploadCard.jsx
│           ├── CalculationCard.jsx
│           ├── ReceiptEditor.jsx
│           ├── LedgerAddCard.jsx
│           ├── FuelPriceCard.jsx
│           ├── LedgerCard.jsx
│           └── ui/
│               ├── Card.jsx
│               ├── Counter.jsx
│               ├── Pill.jsx
│               └── CalcRow.jsx
└── backend/
    ├── pyproject.toml
    ├── .env.example                OPINET_API_KEY, OCR_PROVIDER 등
    ├── app/
    │   ├── main.py                 FastAPI 진입점 + CORS 설정
    │   ├── config.py               환경변수
    │   ├── db.py                   SQLite 엔진·세션
    │   ├── models.py               SQLAlchemy 모델
    │   ├── schemas.py              Pydantic 요청·응답
    │   ├── routers/
    │   │   ├── uploads.py
    │   │   ├── opinet.py
    │   │   ├── calculate.py
    │   │   └── trips.py
    │   └── services/
    │       ├── calculator.py       정산 계산 (순수 함수)
    │       ├── opinet_client.py    오파넷 호출
    │       ├── ocr/
    │       │   ├── base.py         OCRAdapter 프로토콜
    │       │   ├── factory.py      OCR_PROVIDER에 따라 인스턴스 생성
    │       │   ├── upstage.py
    │       │   ├── clova.py
    │       │   ├── claude_vision.py
    │       │   └── local.py
    │       └── exporter.py         XLSX export
    └── tests/
        ├── test_calculator.py      정산 로직 단위 테스트
        ├── test_trips_api.py
        └── fixtures/
            └── sample_evidence.pdf
```

---

## 7. 화면 (프론트엔드)

### 레이아웃
- 데스크탑 기준 max-width 1400px
- xl 이상: 좌측 7/12 (워크벤치) + 우측 5/12 (유가 + 대장)
- 모바일: 1열

### 7.1 좌측 — 3단계 워크플로우

**[1] 증빙서류 업로드**
- 드래그앤드롭 영역
- 파일명, 페이지수, "AI 추출 완료" 배지

**[2] 자동 추출 · 자동 계산** (메인)
1. 출장 기본정보 4필드 (출장자, 일시, 지, 거리)
2. 출장유형 4종 세그먼트
3. 동승자 ± 카운터 (자가차량 모드일 때만)
4. 숙박 ± 카운터 + 지역 select
5. 자동 산정 6라인:
   - 유류비 / 톨게이트 / **대중교통비** / 식비 / 일비 / 숙박비
   - 모드에 따라 활성/비활성
   - 식비는 인라인 카운터 (기본 3식 − 제공받음)
   - 대중교통 모드일 때 **영수증 인라인 편집기** 펼침
6. 정산 합계

**[3] 출장대장에 추가**
- 미리보기 테이블 1행
- "출장대장에 추가하고 다음 건으로" 버튼

### 7.2 우측

**오파넷 일자별 유가 카드**
- 14일치, 요일 배지(평일·토·일 색상)
- 전일대비 ▲/▼
- 출장일 자동 강조

**출장대장 카드** (sticky)
- 엑셀 컬럼 그대로 (No / 제목+사업명 / 출장자 / 출장비 / 시스템 pill)
- 추가된 행 emerald 펄스
- 검색 · 필터 · XLSX 버튼

### 7.3 영수증 편집기

대중교통 모드일 때만 펼침. 설명·금액 인라인 편집, 추가·삭제. **타이핑 중 focus 유지 필수.**

---

## 8. 디자인

### 색상 (Tailwind)
- 베이스: `slate-50/100/200/.../900`
- 강조: `indigo-50/100/600/700/800`
- 성공/AI: `emerald-50/100/500/600/700`
- 경고: `amber-50/100/700`
- 시스템 pill: `sky` (e나라) / `violet` (RCMS) / `emerald` (보탬e) / `amber` (지방비)

### 톤
- 공공기관 친화 + 신뢰감 + 모던
- 카드: `bg-white border border-slate-200 rounded-lg`
- 폰트: `-apple-system, Noto Sans KR`
- 숫자: `tabular-nums`
- 라벨: `text-[10px] uppercase tracking-[0.15em] text-slate-500 font-semibold`

---

## 9. 단계별 작업 계획

### Phase 1 — 셋업 (30분)
- `frontend/`: Vite + React + Tailwind + lucide-react
- `backend/`: FastAPI + SQLAlchemy + SQLite + uvicorn
- 양쪽 `npm run dev` / `uvicorn` 정상 기동 확인
- CORS 설정 (개발: `localhost:5173` 허용)

### Phase 2 — 백엔드 도메인 (1시간)
1. `app/models.py` — 위 SQL 스키마 그대로 SQLAlchemy 모델
2. `app/services/calculator.py` — 정산 계산 (단위 테스트 필수)
3. `app/db.py` — 엔진·세션·`create_all`
4. seed 스크립트 — 출장대장 초기 데이터 5건 + 유가 14일치

### Phase 3 — 백엔드 API (1.5시간)
1. `routers/calculate.py` — `POST /api/calculate`
2. `routers/trips.py` — CRUD + 검색·필터
3. `routers/opinet.py` — 유가 캐싱
4. `routers/uploads.py` — 파일 저장만 (OCR은 mock 응답)
5. http://localhost:8000/docs 에서 모든 엔드포인트 테스트

### Phase 4 — 프론트엔드 (2시간)
1. `lib/constants.js`, `lib/compute.js` (서버와 동일)
2. UI 컴포넌트 (작은 것부터: ui/Card → Counter → Pill → CalcRow)
3. 도메인 컴포넌트 (Header → Upload → Receipt → Calculation → LedgerAdd → FuelPrice → Ledger)
4. `useTravelExpense` 훅 + `lib/api.js`로 백엔드 연결
5. `App.jsx`로 조합 + 빌드 확인

### Phase 5 — OCR 통합 (별도)
1. `services/ocr/base.py` — OCRAdapter 인터페이스
2. 우선 한 가지 구현 (추천: Upstage 또는 Claude Vision)
3. 추출 결과를 trips 후보값으로 변환하는 매퍼
4. `/api/uploads/{id}/extract` 엔드포인트에 연결

### Phase 6 — XLSX export (별도)
1. `services/exporter.py` — openpyxl로 엑셀 `2026 국내②` 시트 형식 그대로
2. `/api/trips/export` 엔드포인트
3. 프론트 XLSX 버튼 연결

---

## 10. 검수 체크리스트

### 백엔드
- [ ] `uvicorn app.main:app --reload` 기동 → http://localhost:8000/docs 접속
- [ ] `POST /api/calculate` 호출 시 프론트와 동일 결과 (회귀 테스트)
- [ ] `POST /api/trips` 호출 → SQLite에 행 저장 + `no` 자동 채번
- [ ] `GET /api/trips?fund=통장` 필터 동작
- [ ] `GET /api/opinet/prices` 캐시 동작 (두 번째 호출 시 외부 API 안 부름)
- [ ] `GET /api/trips/export` 엑셀 다운로드

### 프론트엔드
- [ ] `npm run dev` → http://localhost:5173 정상 표시
- [ ] **자가차량 운전** → 유류비 23,950 + 일비 25,000 = 48,950원 (식비 미제공 시 +25,000)
- [ ] **자가차량 동승**으로 바꾸면 유류비 0, 일비 12,500 + "50% 적용" 배지
- [ ] **대중교통** 선택 시 영수증 편집기 펼침
- [ ] 영수증 금액 수정 시 합계 즉시 재계산 + focus 유지
- [ ] 식비 카운터 +1 → 16,670원 (2식 지급)
- [ ] 숙박 1박 광역시 → 80,000원
- [ ] 우측 유가 카드에 14일치, 출장일 indigo로 강조
- [ ] "출장대장에 추가" 클릭 → 우측 대장에 emerald 펄스로 새 행 추가
- [ ] `npm run build` 통과

---

## 11. Out of Scope (이번에 하지 않는 것)

- TypeScript 마이그레이션
- 인증/로그인 (단일 담당자 가정)
- 다국어 (한국어만)
- 모바일 최적화 (데스크탑 우선)
- 다른 부서 동시 사용 (SQLite 한계 — 추후 PostgreSQL 전환 검토)
- 클라우드 배포
- 120km 미만 단거리 자동 감액 (Phase 7+)
- 결재 라인 / 자금집행 시스템별 자동 전송

---

## 12. 참고 자료

- `_2026_출장처리.xlsx`
  - `출장비 계산` 시트 — 단건 계산 양식
  - `2026 국내②` 시트 — 출장대장 (XLSX export 형식)
  - `유류비①` 시트 — 일자별 보통휘발유 평균가
- `여비지급규정.hwpx` — 별표1 정액표 + 산출기준
- 오파넷 API — 한국석유공사 Opinet, `prodcd=B027` (자동차용 보통휘발유)

---

## 13. Claude Code 작업 팁

- 한 번에 다 만들지 말고 **Phase 단위로 끊어서**, 각 Phase 끝나면 동작 확인 후 다음으로
- 컴포넌트·함수는 **인터페이스(props·시그니처) 먼저 정의**하고 구현
- `services/calculator.py`와 `lib/compute.js`는 **동일 결과 보장** — 양쪽에 같은 테스트 케이스를 두면 회귀 방지 가능
- Tailwind 클래스가 길어지면 컴포넌트로 분리 (인라인 style 금지)
- 새 기능 추가 시 이 README.md 하단 변경 이력에 한 줄 남기기

---

## 14. 변경 이력

- 2026-06-20: 초안 작성 (프론트·백엔드 통합, Phase 1~6 정의)
- 2026-06-20: Phase 1 셋업 완료 — frontend(Vite+React+Tailwind+lucide), backend(FastAPI+SQLAlchemy+SQLite) 스캐폴딩, CORS·`/api` 프록시·`/api/health` 구성
- 2026-06-20: Phase 2 백엔드 도메인 완료 — `models.py`(4 테이블), `services/calculator.py`(정산 순수함수 + 적용규정 추적), `seed.py`(출장 5건·유가 14일치), `tests/test_calculator.py`(23 케이스 통과)
- 2026-06-20: Phase 3 백엔드 API 완료 — `schemas.py`(Pydantic), 라우터 4종 (`/api/calculate`·`trips` CRUD+검색·`opinet`·`uploads`+mock OCR), `services/opinet_client.py`는 `avgRecentPrice.do` 사용(7일치 일괄 캐시). `/docs` 에서 전 엔드포인트 검증, seed 캐시 14일치 조회 동작 확인.
- 2026-06-20: Phase 4 프론트엔드 완료 — `lib/{constants,compute,api,mockData}.js`, `components/{ui/Card,Counter,Pill,CalcRow / Header,UploadCard,ReceiptEditor,CalculationCard,LedgerAddCard,FuelPriceCard,LedgerCard}.jsx`, `hooks/useTravelExpense.js`. 모든 카드가 디자인 미리보기와 동일, 백엔드와 실연결(대장 로드·유가 로드·업로드+mock OCR·정산 합계 저장→DB No.147 확인). 영수증 편집기는 controlled input + 안정적 key로 focus 유지.
- 2026-06-20: Phase 5 OCR 통합 완료 — `services/ocr/{base,factory,mock,upstage,claude_vision}.py`. `OCR_PROVIDER` 환경변수로 어댑터 선택. uploads 라우터를 factory 사용으로 교체 + raw 결과 `attachments.ocr_result_json` 저장.
- 2026-06-20: Phase 6 XLSX export 완료 — `services/exporter.py` (openpyxl, 시트 `2026 국내②`, 20컬럼 + 합계 SUM 공식 + 인디고 헤더), `GET /api/trips/export` (필터 그대로 적용), 프론트 출장대장 카드의 XLSX 버튼 동작. 브라우저에서 6555 bytes 다운로드 확인.
- 2026-06-20: 오파넷 라이브 연동 + 캐시 누적 표시 (60일 범위 조회). OCR `local` 어댑터 추가 — RapidOCR(PaddleOCR 모델, ONNX) 완전 무료 로컬 OCR. PNG에서 출장일/시간/거리 실추출 확인. 카드 ④ "지급내역(그룹웨어 복사용)" — 동승자 행 자동 + HTML/text 표 복사. 업로드 영역 드래그앤드롭 (PDF/JPG/PNG 검증 + 시각 피드백). 카드 ② 초기 mock 제거 → 빈 상태 "—" 표시.
- 2026-06-20: 배포 자동화 — `install.bat`/`run.bat`/`update.bat` (CP949 + CRLF, 한글 출력 검증 완료). Python/Node winget 자동 설치, OCR 모델 사전 다운로드, .env 자동 복사, 두 서버 새 창 + 브라우저 오픈, git pull + 의존성 동기화.

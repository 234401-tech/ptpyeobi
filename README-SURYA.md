# Surya OCR 셋업 가이드

작은 한글에 강한 오픈소스 OCR. NVIDIA A4500 같은 GPU 가 있으면 빠르고, CPU 만 있어도 동작.

## ⚠ 라이선스

- **코드**: GPL-3.0
- **모델 가중치**: CC-BY-NC-SA 4.0 (비영리 사용)
- **상업적 사용**: Surya Pro 별도 라이선스 필요 (https://datalab.to)

공공기관 내부 행정용은 일반적으로 비영리로 해석됩니다만, 운영 부서/법무팀에 한 번 확인 권장.

## 적용 효과

| 항목 | local (RapidOCR) | Surya | GOT-OCR 2.0 |
|---|---|---|---|
| 작은 한글 (박진석/김승모) | 못 읽음 | ◎ | ◎◎ |
| 한국어 영수증 라벨 | 깨짐 | 정확 | 정확 |
| CPU 1페이지 | 1~3초 | 5~15초 | 매우 느림 |
| GPU 1페이지 | — | 1~3초 | 2~5초 |
| VRAM | — | 약 2~4GB | 약 6~8GB |
| 모델 크기 | 10MB | ~1GB | ~1.5GB |

## 사전 조건

- Python 3.10 ~ 3.12 (Python 3.13 은 PyTorch 안정 빌드 부족 가능)
- (선택) NVIDIA 드라이버 + CUDA 11.8/12.x

## 설치

```bash
git clone https://github.com/234401-tech/ptpyeobi.git
cd ptpyeobi/backend

# 가상환경 (Linux/Mac)
python3.11 -m venv .venv && source .venv/bin/activate
# Windows: python -m venv .venv && .venv\Scripts\activate

# 1. 기본 의존성
pip install -r requirements.txt

# 2. PyTorch (GPU 환경별)
# CPU 만:
pip install torch
# CUDA 12.1:
# pip install torch --index-url https://download.pytorch.org/whl/cu121
# CUDA 11.8:
# pip install torch --index-url https://download.pytorch.org/whl/cu118

# 3. Surya 의존성
pip install -r requirements-surya.txt

# 4. .env 에 OCR_PROVIDER=surya 설정
cp .env.example .env
# 파일 열어서 OCR_PROVIDER=surya 로 변경
```

## 동작 확인

```bash
python -c "
from app.services.ocr.factory import get_ocr
adapter = get_ocr()
print('어댑터:', adapter.name)
# 첫 호출 시 모델 다운로드 (~1GB, HF 캐시: ~/.cache/huggingface)
result = adapter.extract('/path/to/test.png')
print(result)
"
```

- 첫 실행은 모델 다운로드 때문에 1~3분 걸림
- 이후 같은 프로세스 안에서는 모델 메모리에 상주

## 서버 기동

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

회사망 다른 PC에서 접속하려면 방화벽 8000 포트 허용.

## 운영 팁

- **메모리**: Surya 는 lazy 로드. 첫 OCR 호출 시점에 PyTorch 모델이 메모리/VRAM 점유.
- **GPU 자동 감지**: CUDA 가 있으면 자동으로 GPU 사용. 없으면 CPU 폴백.
- **모델 캐시**: `~/.cache/huggingface/hub/` (Linux), `%USERPROFILE%\.cache\huggingface\hub\` (Windows)
- **언어**: 어댑터 코드에서 `langs=['ko', 'en']` 고정. 다른 언어 필요하면 `surya.py` 수정.

## 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| `surya-ocr 가 설치되지 않았습니다` | requirements-surya.txt 미설치 | 위 설치 단계 4번 다시 |
| `cuda is not available` | PyTorch CPU 버전 | 자동으로 CPU 폴백, 느려지지만 동작 |
| OOM | VRAM 부족 | 다른 GPU 프로세스 종료 또는 CPU 폴백 |
| 첫 요청만 느림 | 모델 다운로드+로드 | 정상. 두 번째 요청부터 빠름 |
| 결과 빈 응답 | 이미지 해상도 너무 낮음 | 200dpi 이상 권장 |

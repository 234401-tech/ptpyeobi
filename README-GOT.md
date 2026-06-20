# GOT-OCR 2.0 회사 서버 셋업 가이드

NVIDIA A4500 같은 GPU 서버에서 GOT-OCR 2.0 어댑터를 활성화하는 방법.

## 적용 효과

| 항목 | 현재 (local / RapidOCR) | GOT-OCR 2.0 |
|---|---|---|
| 작은 한글 (박진석/김승모) | 못 읽음 | ◎ 정확 |
| 한국어 영수증 라벨 | 깨짐 (한자 오인식) | 정확 |
| 한 페이지 처리 시간 | 1~3초 (CPU) | 2~5초 (GPU) |
| VRAM 사용량 | — | 약 6~8GB (FP16) |
| 모델 크기 | 10MB | 약 1.5GB |
| 비용 | 무료 | 무료 (Apache-2.0) |

## 사전 조건

- **OS**: Linux 권장 (Windows 도 가능)
- **GPU**: VRAM 8GB 이상 (A4500 20GB 충분)
- **CUDA**: 11.8 또는 12.x
- **NVIDIA 드라이버**: 525 이상
- **Python**: 3.10~3.11 권장 (Python 3.13 은 PyTorch 안정 빌드 부족할 수 있음)

## 설치

```bash
# 1. 저장소 클론 + 백엔드 가상환경
git clone https://github.com/234401-tech/ptpyeobi.git
cd ptpyeobi/backend
python3.11 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# 2. 기본 의존성
pip install -r requirements.txt

# 3. PyTorch CUDA (버전 맞춰서)
# CUDA 12.1:
pip install torch --index-url https://download.pytorch.org/whl/cu121
# CUDA 11.8:
# pip install torch --index-url https://download.pytorch.org/whl/cu118

# 4. GOT-OCR 의존성
pip install -r requirements-got.txt

# 5. .env 에 GOT 활성화
cp .env.example .env
# 파일 열어서 OCR_PROVIDER=got 로 변경
```

## 동작 확인

```bash
python -c "
from app.services.ocr.factory import get_ocr
adapter = get_ocr()
print('어댑터:', adapter.name)
# 첫 호출 시 모델 다운로드 (~1.5GB, HF 캐시: ~/.cache/huggingface)
result = adapter.extract('/path/to/test.png')
print(result)
"
```

첫 실행은 모델 다운로드 때문에 1~3분 걸림. 이후는 GPU 로드 후 2~5초/페이지.

## 서버 기동

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

- 회사망 다른 PC에서 접속하려면 `--host 0.0.0.0` + 방화벽 8000 포트 허용
- 프론트는 `frontend/vite.config.js` 의 `proxy.target` 을 서버 IP로 바꾸거나
  배포 시 `npm run build` 의 `dist/` 를 서버에 같이 배포

## 운영 팁

- **VRAM 절약**: GOT 어댑터는 lazy load. 백엔드 기동 시점엔 메모리 사용 없음.
  첫 OCR 호출 후 모델 로드. 이후 같은 모델 재사용.
- **GPU 공유**: 다른 ML 프로세스와 공유하면 OOM 위험. 전용 또는 우선순위 조정.
- **모델 캐시 위치**: `~/.cache/huggingface/hub/` (Linux), `%USERPROFILE%\.cache\huggingface\hub\` (Windows)
- **fallback**: GOT 실패 시 자동으로 local 로 떨어지지 않음. 필요하면 routers/uploads.py 에서 try/except 로 처리 추가.

## 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| `CUDA out of memory` | VRAM 부족 또는 다른 프로세스 점유 | `nvidia-smi` 확인, 다른 GPU 작업 종료 |
| `cuda is not available` | PyTorch CPU 버전 설치됨 | CUDA 빌드로 재설치 |
| `trust_remote_code` 경고 | HF 모델 커스텀 코드 로드 | 정상. GOT 모델은 trust_remote_code 필수 |
| 첫 요청만 느림 | 모델 GPU 로드 | 정상. 두 번째 요청부터 빠름 |
| 한국어 결과 깨짐 | tokenizer 미설치 | `pip install sentencepiece tiktoken` |

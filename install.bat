@echo off

echo ============================================================
echo  여비뚝딱 서버 설치
echo ============================================================
echo.

REM ── Python 확인 + winget 자동 설치 ──────────────────────────
where py >nul 2>nul
if errorlevel 1 (
    echo [Python] 설치되지 않음. winget으로 자동 설치합니다...
    where winget >nul 2>nul
    if errorlevel 1 (
        echo [오류] winget 을 찾을 수 없습니다.
        echo        https://www.python.org/downloads/ 에서 Python 3.11+ 를 직접 설치한 뒤
        echo        새 cmd 창에서 다시 install.bat 을 실행해주세요.
        pause
        exit /b 1
    )
    winget install -e --id Python.Python.3.11 --accept-source-agreements --accept-package-agreements
    if errorlevel 1 (
        echo [오류] Python 자동 설치 실패.
        pause
        exit /b 1
    )
    echo [Python] 설치 완료. 환경변수 적용을 위해 새 cmd 창에서 install.bat 을 다시 실행하세요.
    pause
    exit /b 0
) else (
    for /f "tokens=2 delims= " %%v in ('py --version 2^>^&1') do echo [Python] %%v 확인
)

REM ── Node.js 확인 + winget 자동 설치 ─────────────────────────
where npm >nul 2>nul
if errorlevel 1 (
    echo [Node.js] 설치되지 않음. winget으로 자동 설치합니다...
    where winget >nul 2>nul
    if errorlevel 1 (
        echo [오류] winget 을 찾을 수 없습니다.
        echo        https://nodejs.org/ 에서 LTS 를 설치한 뒤 다시 실행해주세요.
        pause
        exit /b 1
    )
    winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    if errorlevel 1 (
        echo [오류] Node.js 자동 설치 실패.
        pause
        exit /b 1
    )
    echo [Node.js] 설치 완료. 새 cmd 창에서 install.bat 을 다시 실행하세요.
    pause
    exit /b 0
) else (
    for /f "tokens=*" %%v in ('node --version') do echo [Node.js] %%v 확인
)

REM ── 백엔드 ──────────────────────────────────────────────────
echo.
echo [1/4] 백엔드 가상환경 + 의존성 설치
cd /d "%~dp0backend"
if not exist .venv (
    py -m venv .venv
    if errorlevel 1 (
        echo [오류] 가상환경 생성 실패.
        pause
        exit /b 1
    )
)
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip --quiet
pip install -r requirements.txt
if errorlevel 1 (
    echo [오류] 백엔드 의존성 설치 실패.
    pause
    exit /b 1
)

REM ── .env 자동 복사 ─────────────────────────────────────────
if not exist .env (
    copy .env.example .env >nul
    echo.
    echo [.env] backend\.env 파일을 생성했습니다.
    echo        OPINET_API_KEY 같은 값이 필요하면 메모장으로 열어 직접 입력하세요.
)

REM ── OCR 모델 사전 다운로드 ─────────────────────────────────
echo.
echo [2/4] OCR 모델 다운로드 (처음 한 번, 약 10~30초)
python -c "from rapidocr_onnxruntime import RapidOCR; RapidOCR()" 2>nul
if errorlevel 1 (
    echo [경고] OCR 모델 사전 로드 실패. 첫 호출 때 다운로드됩니다.
)

REM ── 초기 데이터 ────────────────────────────────────────────
echo.
echo [3/4] 초기 데이터 시드 (출장 5건 + 유가 14일치)
python -m app.seed
deactivate

REM ── 프론트엔드 ──────────────────────────────────────────────
echo.
echo [4/4] 프론트엔드 의존성 설치 (몇 분 걸릴 수 있음)
cd /d "%~dp0frontend"
call npm install
if errorlevel 1 (
    echo [오류] 프론트엔드 의존성 설치 실패.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  설치 완료!
echo    run.bat       서버 실행
echo    update.bat    GitHub 최신 코드 가져오기
echo ============================================================
pause

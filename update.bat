@echo off

echo ============================================================
echo  여비뚝딱 업데이트 (GitHub 최신 코드 + 의존성 동기화)
echo ============================================================
echo.

cd /d "%~dp0"

REM ── git 확인 ────────────────────────────────────────────────
where git >nul 2>nul
if errorlevel 1 (
    echo [오류] git 이 설치되어 있지 않습니다.
    echo        https://git-scm.com/download/win 에서 설치 후 다시 실행하세요.
    pause
    exit /b 1
)

REM ── git pull ───────────────────────────────────────────────
echo [1/3] GitHub 최신 코드 받기 (git pull)
git pull
if errorlevel 1 (
    echo.
    echo [경고] git pull 에 문제가 있었습니다. 충돌이면 수동으로 해결 후 다시 실행하세요.
    echo        로컬 변경분이 있으면 먼저 commit 또는 stash 가 필요할 수 있습니다.
    pause
    exit /b 1
)

REM ── 백엔드 의존성 ──────────────────────────────────────────
echo.
echo [2/3] 백엔드 의존성 동기화
cd /d "%~dp0backend"
if not exist .venv (
    echo .venv 가 없어 새로 만듭니다.
    py -m venv .venv
)
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip --quiet
pip install -r requirements.txt
if errorlevel 1 (
    echo [경고] 백엔드 의존성 설치에 문제가 있습니다.
)
deactivate

REM ── 프론트엔드 의존성 ─────────────────────────────────────
echo.
echo [3/3] 프론트엔드 의존성 동기화
cd /d "%~dp0frontend"
call npm install
if errorlevel 1 (
    echo [경고] 프론트엔드 의존성 설치에 문제가 있습니다.
)

echo.
echo ============================================================
echo  업데이트 완료! run.bat 으로 서버를 다시 띄우세요.
echo  (DB 파일은 data\ 폴더에 그대로 보존됩니다)
echo ============================================================
pause

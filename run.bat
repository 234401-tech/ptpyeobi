@echo off

echo ============================================================
echo  여비뚝딱 서버 실행
echo ============================================================
echo.

REM 가상환경 / node_modules 존재 확인
if not exist "%~dp0backend\.venv" (
    echo [오류] 백엔드 가상환경이 없습니다. 먼저 install.bat 을 실행하세요.
    pause
    exit /b 1
)
if not exist "%~dp0frontend\node_modules" (
    echo [오류] 프론트엔드 의존성이 없습니다. 먼저 install.bat 을 실행하세요.
    pause
    exit /b 1
)

REM ── 백엔드 새 창 (8000) ────────────────────────────────────

REM ── 프론트 새 창 (5173) ────────────────────────────────────

REM ── 서버 기동 대기 + 브라우저 자동 열기 ────────────────────
echo 서버를 기동하는 중...
timeout /t 5 /nobreak > nul
start "" http://localhost:5173

echo.
echo ============================================================
echo  실행 완료
echo    프론트엔드   http://localhost:5173   (메인 화면)
echo    백엔드 API   http://localhost:8000/docs
echo.
echo  종료하려면 "백엔드"·"프론트" 두 창을 닫으세요.
echo ============================================================
pause

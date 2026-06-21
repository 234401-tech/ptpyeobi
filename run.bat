@echo off
title 여비뚝딱 서버

if not exist "%~dp0backend\.venv\Scripts\python.exe" (
    echo [오류] 백엔드 가상환경이 없습니다. 먼저 install.bat 을 실행하세요.
    pause
    exit /b 1
)
if not exist "%~dp0frontend\node_modules" (
    echo [오류] 프론트엔드 의존성이 없습니다. 먼저 install.bat 을 실행하세요.
    pause
    exit /b 1
)

REM 이전 실행에서 남은 포트 점유 정리
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":8000 " ^| findstr LISTENING') do taskkill /f /pid %%P >nul 2>&1
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":5173 " ^| findstr LISTENING') do taskkill /f /pid %%P >nul 2>&1

REM LAN IP 자동 추출
set "LAN_IP="
for /f "tokens=2 delims=:" %%I in ('ipconfig ^| findstr /R /C:"IPv4.*: 192\." /C:"IPv4.*: 10\." /C:"IPv4.*: 172\."') do (
    if not defined LAN_IP set "LAN_IP=%%I"
)
set "LAN_IP=%LAN_IP: =%"
if not defined LAN_IP set "LAN_IP=localhost"

pushd "%~dp0backend"
start "여비뚝딱-백엔드" /b "%~dp0backend\.venv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > nul 2>&1
popd

timeout /t 5 /nobreak > nul

cls
echo.
echo  여비뚝딱 - 차량 유류비 정산 시스템
echo  ============================================================
echo   프론트엔드     http://localhost:5173
echo   팀원 접속      http://%LAN_IP%:5173
echo   백엔드 API     http://localhost:8000/docs
echo  ============================================================
echo.
echo  이 창을 닫거나 Ctrl+C 를 누르면 두 서버가 모두 종료됩니다.
echo.

start "" http://localhost:5173

pushd "%~dp0frontend"
call npm run dev
popd

echo.
echo [정리] 백엔드 종료 중...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":8000 " ^| findstr LISTENING') do taskkill /f /pid %%P >nul 2>&1
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":5173 " ^| findstr LISTENING') do taskkill /f /pid %%P >nul 2>&1
echo 종료되었습니다.
pause

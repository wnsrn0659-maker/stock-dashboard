@echo off
chcp 65001 >nul
title 주식 버즈 서버
cd /d "%~dp0stocks-api"

echo ============================================
echo    주식 버즈(언급량) 수집 서버
echo ============================================
echo.

REM Node.js 설치 확인
where node >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js 가 설치되어 있지 않습니다.
  echo.
  echo     1) https://nodejs.org 접속
  echo     2) 왼쪽 "LTS" 버튼 다운로드 후 설치 ^(계속 다음 클릭^)
  echo     3) 설치 끝나면 이 파일을 다시 더블클릭하세요.
  echo.
  pause
  exit /b
)

echo [v] Node.js 확인 완료
echo.

REM 최초 1회만 필요한 부품 설치
if not exist node_modules (
  echo [*] 최초 1회 부품 설치 중... 2~5분 정도 걸립니다. 기다려 주세요.
  echo.
  call npm install
  echo.
)

echo ============================================
echo  [v] 버즈 서버 시작! 이 검은 창을 닫지 마세요.
echo.
echo  대시보드에서 "버즈 연동" 버튼을 누르고
echo  아래 주소를 입력하세요:
echo.
echo      http://localhost:3001
echo.
echo  (서버를 끄려면 이 창을 닫으면 됩니다)
echo ============================================
echo.

node server.js --with-collector
pause

@echo off
chcp 65001 > nul
title J.A.R.V.I.S 서버 실행 중...

echo.
echo  ╔══════════════════════════════════════╗
echo  ║   J.A.R.V.I.S  서버 시작 중...      ║
echo  ║   여누솔루션 황순주 AI 비서          ║
echo  ╚══════════════════════════════════════╝
echo.

:: Python 설치 확인
python --version > nul 2>&1
if %errorlevel% neq 0 (
    python3 --version > nul 2>&1
    if %errorlevel% neq 0 (
        echo  [오류] Python이 설치되어 있지 않습니다.
        echo.
        echo  Python 설치 방법:
        echo  1. https://www.python.org/downloads 접속
        echo  2. Download Python 클릭 후 설치
        echo  3. 설치 시 "Add Python to PATH" 반드시 체크!
        echo.
        pause
        exit /b
    )
    set PYTHON_CMD=python3
) else (
    set PYTHON_CMD=python
)

:: jarvis_hsj.html 파일 위치 확인
if not exist "%~dp0jarvis_hsj.html" (
    echo  [오류] jarvis_hsj.html 파일을 찾을 수 없습니다.
    echo.
    echo  이 bat 파일과 jarvis_hsj.html 파일을
    echo  같은 폴더에 넣어주세요.
    echo.
    pause
    exit /b
)

:: 서버 시작 (포트 8080)
echo  ✓ Python 확인 완료
echo  ✓ JARVIS 파일 확인 완료
echo.
echo  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo  서버 주소: http://localhost:8080/jarvis_hsj.html
echo  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo  잠시 후 Chrome이 자동으로 열립니다...
echo  종료하려면 이 창을 닫으세요.
echo.

:: 2초 후 Chrome 자동 실행
ping 127.0.0.1 -n 3 > nul
start "" "http://localhost:8080/jarvis_hsj.html"

:: Python 서버 실행
cd /d "%~dp0"
%PYTHON_CMD% -m http.server 8080

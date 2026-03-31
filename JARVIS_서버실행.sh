#!/bin/bash

echo ""
echo " ╔══════════════════════════════════════╗"
echo " ║   J.A.R.V.I.S  서버 시작 중...      ║"
echo " ║   여누솔루션 황순주 AI 비서          ║"
echo " ╚══════════════════════════════════════╝"
echo ""

# 스크립트 위치로 이동
cd "$(dirname "$0")"

# Python 확인
if command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
elif command -v python &>/dev/null; then
    PYTHON_CMD="python"
else
    echo " [오류] Python이 설치되어 있지 않습니다."
    echo ""
    echo " Mac: brew install python3"
    echo " 또는 https://www.python.org/downloads 에서 설치"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

# 파일 확인
if [ ! -f "jarvis_hsj.html" ]; then
    echo " [오류] jarvis_hsj.html 파일을 찾을 수 없습니다."
    echo " 이 sh 파일과 같은 폴더에 jarvis_hsj.html을 넣어주세요."
    read -p "Press Enter to exit..."
    exit 1
fi

echo " ✓ Python 확인 완료 ($PYTHON_CMD)"
echo " ✓ JARVIS 파일 확인 완료"
echo ""
echo " ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " 서버 주소: http://localhost:8080/jarvis_hsj.html"
echo " ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo " 종료: Ctrl+C"
echo ""

# 브라우저 자동 실행 (Mac)
sleep 1
if [[ "$OSTYPE" == "darwin"* ]]; then
    open "http://localhost:8080/jarvis_hsj.html"
else
    xdg-open "http://localhost:8080/jarvis_hsj.html" 2>/dev/null
fi

# 서버 실행
$PYTHON_CMD -m http.server 8080

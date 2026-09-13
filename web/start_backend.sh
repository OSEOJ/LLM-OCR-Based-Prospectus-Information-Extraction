#!/bin/bash

# FastAPI 서버 실행 스크립트

echo "PDF to JSON Converter 백엔드 서버를 시작합니다..."

# 현재 디렉터리 확인
cd "$(dirname "$0")"

# 가상환경 확인 (선택사항)
if [[ "$VIRTUAL_ENV" != "" ]]; then
    echo "가상환경이 활성화되었습니다: $VIRTUAL_ENV"
else
    echo "⚠️  가상환경이 활성화되지 않았습니다. Python 패키지가 시스템에 설치되어야 합니다."
fi

# 환경변수 파일 확인
if [[ ! -f ".env" ]]; then
    echo "❌ .env 파일을 찾을 수 없습니다. 먼저 .env 파일을 설정해주세요."
    exit 1
fi

echo "✅ .env 파일이 확인되었습니다."

# 필요한 디렉터리 생성
mkdir -p ../temp
mkdir -p ../output
mkdir -p ../prompts

echo "✅ 필요한 디렉터리가 생성되었습니다."

# 서버 실행
echo "🚀 FastAPI 서버를 시작합니다..."
echo "서버 주소: http://localhost:8000"
echo "API 문서: http://localhost:8000/docs"
echo ""
echo "서버를 중지하려면 Ctrl+C를 누르세요."

cd backend
python main.py

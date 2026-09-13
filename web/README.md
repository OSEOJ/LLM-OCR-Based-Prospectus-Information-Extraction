# PDF to JSON Converter

PDF 파일을 OCR로 텍스트 변환 후 LLM을 통해 금융 상품 정보를 JSON으로 추출하는 웹 애플리케이션입니다.

## 🚀 주요 기능

### 1. **PDF → OCR → JSON 파이프라인**
- **EasyOCR**: PDF를 고품질 텍스트로 변환
- **OpenAI GPT**: 텍스트를 구조화된 JSON으로 변환
- **지능형 표 처리**: 표와 일반 텍스트를 구분하여 정확한 정보 추출

### 2. **지원 금융 상품**
- **채권선도 (Bond Forward)**: 15개 필드의 상세 정보 추출
- **FRN (Floating Rate Note)**: 변동금리채권 정보 추출
- **IRS (Interest Rate Swap)**: 금리스왑 정보 추출

상품별 프롬프트는 `prompts/prompts.yaml` 에 버전과 함께 정의돼 있습니다.
CRS(통화스왑)는 아직 프롬프트가 없어 UI에 노출하지 않습니다.

### 3. **사용자 친화적 인터페이스**
- 드래그 앤 드롭 파일 업로드
- WebSocket 기반 페이지 단위 실시간 진행률
- **일괄 OCR**: 여러 파일을 연결 하나로 묶어 병렬 처리 (`/ws/ocr-batch`)
- 추출값의 원문 위치 하이라이트 (검수용)
- JSON/TXT 파일 개별 다운로드, ZIP 일괄 다운로드

## 🛠️ 기술 스택

### Frontend
- **React 19**: 최신 React 버전
- **Modern CSS**: 그라디언트, 애니메이션, 반응형 디자인

### Backend
- **FastAPI**: 고성능 Python 웹 프레임워크
- **EasyOCR**: GPU 가속 OCR 엔진
- **OpenAI API**: `.env` 의 `MODEL_NAME` 으로 모델 지정
- **Python**: 이미지 처리 및 데이터 변환

## 📋 설치 및 설정

### 1. 환경 요구사항
```bash
# Node.js 16+ 
# Python 3.8+
# OpenAI API 키
```

### 2. 의존성 설치
```bash
# 프론트엔드 패키지
npm install

# 백엔드 패키지 (가상환경 권장)
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 또는 venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

### 3. 환경변수 설정
`.env` 파일에서 다음 값들을 설정하세요:

```env
# 🔑 필수: OpenAI API 키를 설정하세요
OPENAI_API_KEY=your_actual_openai_api_key_here

# 기타 설정들은 기본값 사용 권장
```

### 4. 실행

#### ⚡ 기본 실행 (권장) - 자동 서버 시작
```bash
npm start
# 프론트엔드 (포트 3000) + 백엔드 (포트 8000) 자동 시작
```

#### 🔧 개별 실행
```bash
# 프론트엔드만 실행
npm run frontend
# 또는
npm run start:frontend-only

# 백엔드만 실행  
npm run backend
# 또는
npm run start:backend-only
```

#### 🌐 공개 접속 (터널링)
```bash
npm run start:public
# 로컬 개발 환경을 인터넷에 공개 (localtunnel 사용)
```

#### 🧰 개발 도구
```bash
# 코드 검사
npm run lint

# 코드 자동 수정
npm run lint:fix

# 프로젝트 정리
npm run clean
```

### 5. 접속
- **웹 애플리케이션**: http://localhost:3000
- **API 문서**: http://localhost:8001/docs

## 📁 프로젝트 구조

```
web/
├── src/                      # React 프론트엔드
│   ├── components/
│   │   └── FileConverter.js  # 메인 UI 컴포넌트
│   ├── App.js               # 앱 루트 컴포넌트
│   ├── App.css              # 메인 스타일
│   ├── index.js             # React 진입점
│   └── index.css            # 글로벌 스타일
├── backend/                  # FastAPI 백엔드
│   ├── main.py              # API 엔드포인트
│   └── services/            # 비즈니스 로직
│       ├── ocr_service.py   # OCR 처리
│       ├── llm_service.py   # LLM 처리
│       └── file_service.py  # 파일 관리
├── public/                   # React 정적 파일
│   ├── index.html
│   ├── favicon.ico
│   └── manifest.json
├── prompts/
│   └── prompts.yaml         # LLM 프롬프트 템플릿
├── package.json             # Node.js 의존성
├── requirements.txt         # Python 의존성
├── start_backend.sh         # 백엔드 실행 스크립트
└── .env                     # 환경 변수 (생성 필요)
```

## 📖 사용 방법

1. **PDF 업로드**: 드래그 앤 드롭 또는 파일 선택
2. **상품 유형 선택**: 채권선도 또는 FRN
3. **변환 과정 확인**: OCR → LLM → JSON
4. **결과 다운로드**: JSON/TXT 파일

## 🎯 JSON 출력 예시

### 채권선도 (Bond Forward)
```json
{
  "포지션": "B",
  "액면통화": "KRW", 
  "액맨금액": "10000000000",
  "기초자산": "KRC035LP5331",
  "효력발생일": "20250519",
  "만기일": "20270928",
  "BDC": "F",
  "영업일적용여부": "U",
  "영업일적용도시": "SE", 
  "정산방식": "P",
  "채권유형": "FI",
  "표면금리": "0",
  "만기정산금액": "5276190000",
  "선도가격": "0.527619",
  "결제통화": "KRW"
}
```

## 🚨 주의사항

1. **OpenAI API 키 설정 필수**
2. **API 사용료 발생 가능**
3. **GPU 사용 권장** (OCR 성능 향상)

---

🎯 **금융 문서의 정확한 정보 추출을 위한 전문 도구입니다.**

## 테스트

OCR 엔진과 파일 서비스를 스텁으로 대체하므로 API 키 없이 돌아갑니다.

```bash
cd backend
python test_prompts.py      # 상품별 프롬프트 조회. 대소문자 표기 불일치 회귀 방지
python test_ocr_batch.py    # /ws/ocr-batch 메시지 계약, 파일별 오류 격리
```

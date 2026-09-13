# 🌐 외부 접근 가능한 터널 설정 가이드

이 가이드는 로컬에서 실행 중인 애플리케이션을 외부에서 접근할 수 있도록 하는 방법을 설명합니다.

## 🚀 사용 방법

### 1. 모든 서비스를 외부에 공개 (권장)
```bash
npm run dev:public
```
이 명령어는 다음을 동시에 실행합니다:
- 백엔드 서버 (FastAPI)
- 프론트엔드 서버 (React)
- 프론트엔드 터널 (포트 3000)
- 백엔드 터널 (포트 8000)

### 2. 개별 터널 실행

#### 프론트엔드만 터널로 공개
```bash
npm run tunnel:frontend
```

#### 백엔드 API만 터널로 공개
```bash
npm run tunnel:backend
```

#### 둘 다 터널로 공개 (서버는 별도 실행)
```bash
npm run tunnel:both
```

## 🔗 접속 URL

실행하면 다음과 같은 URL이 생성됩니다:

### 프론트엔드 (웹 애플리케이션)
- **로컬**: http://localhost:3000
- **외부**: https://pdf-converter-frontend.loca.lt

### 백엔드 (API 서버)
- **로컬**: http://localhost:8000
- **외부**: https://pdf-converter-api.loca.lt
- **API 문서**: https://pdf-converter-api.loca.lt/docs

## ⚠️ 주의사항

1. **보안**: 터널을 통해 공개되는 서비스는 인터넷 전체에서 접근 가능합니다.
2. **성능**: 터널을 통한 접근은 직접 접근보다 느릴 수 있습니다.
3. **안정성**: 무료 localtunnel 서비스는 때때로 불안정할 수 있습니다.
4. **서브도메인**: 지정한 서브도메인이 이미 사용 중이면 랜덤 URL이 할당됩니다.

## 🛡️ 보안 설정

현재 CORS 설정에서 다음 출처를 허용합니다:
- localhost (로컬 개발)
- *.loca.lt (localtunnel 도메인)

추가 보안이 필요한 경우 백엔드의 `main.py`에서 CORS 설정을 수정하세요.

## 🔧 문제 해결

### 터널이 연결되지 않는 경우
1. 포트가 이미 사용 중인지 확인
2. 방화벽 설정 확인
3. 다른 서브도메인 이름 시도

### API 호출이 실패하는 경우
1. 백엔드 서버가 실행 중인지 확인
2. CORS 설정 확인
3. 브라우저 개발자 도구에서 네트워크 탭 확인

## 📝 예시 사용법

```bash
# 1. 모든 의존성 설치
npm run setup

# 2. 외부 접근 가능한 개발 서버 시작
npm run dev:public

# 3. 터미널에 표시되는 URL로 접속
# 예: https://pdf-converter-frontend.loca.lt
```

이제 다른 사람들도 인터넷을 통해 당신의 PDF to JSON 변환기를 사용할 수 있습니다! 🎉

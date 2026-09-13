// Frontend Configuration Management
class AppConfig {
  constructor() {
    this.apiBaseUrl = this.detectApiUrl();
    this.wsBaseUrl = this.detectWebSocketUrl();
    this.fileUpload = {
      maxSizeMB: 50,
      allowedTypes: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      allowedExtensions: ['.pdf', '.docx']
    };
    this.ocr = {
      maxPages: 10,
      progressUpdateInterval: 500, // ms
      retryAttempts: 3,
      retryDelay: 1000 // ms
    };
    this.ui = {
      debounceDelay: 300,
      animationDuration: 200,
      toastDuration: 5000
    };
    this.development = {
      enableDevTools: process.env.NODE_ENV === 'development',
      enableConsoleLogs: process.env.NODE_ENV === 'development'
    };
  }

  detectApiUrl() {
    // 환경 변수 확인
    if (process.env.REACT_APP_API_URL) {
      return process.env.REACT_APP_API_URL;
    }

    // 현재 호스트 기반 자동 감지
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    
    // 개발 환경
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${protocol}//localhost:8000`;
    }
    
    // 프로덕션 환경 - 같은 호스트의 8000 포트
    return `${protocol}//${hostname}:8000`;
  }

  detectWebSocketUrl() {
    const apiUrl = this.apiBaseUrl;
    return apiUrl.replace(/^http/, 'ws');
  }

  getApiEndpoint(path) {
    return `${this.apiBaseUrl}${path.startsWith('/') ? path : '/' + path}`;
  }

  getWebSocketEndpoint(path) {
    return `${this.wsBaseUrl}${path.startsWith('/') ? path : '/' + path}`;
  }

  validateFile(file) {
    const errors = [];

    // 파일 타입 검증
    if (!this.fileUpload.allowedTypes.includes(file.type)) {
      errors.push('PDF 또는 DOCX 파일만 업로드 가능합니다.');
    }

    // 파일 크기 검증
    const maxSizeBytes = this.fileUpload.maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      errors.push(`파일 크기는 ${this.fileUpload.maxSizeMB}MB 이하여야 합니다.`);
    }

    // 파일명 검증
    if (!file.name || file.name.trim() === '') {
      errors.push('올바른 파일명이 필요합니다.');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  log(...args) {
    if (this.development.enableConsoleLogs) {
      console.log('[AppConfig]', ...args);
    }
  }

  warn(...args) {
    if (this.development.enableConsoleLogs) {
      console.warn('[AppConfig]', ...args);
    }
  }

  error(...args) {
    if (this.development.enableConsoleLogs) {
      console.error('[AppConfig]', ...args);
    }
  }

  // 환경 정보 반환
  getEnvironmentInfo() {
    return {
      nodeEnv: process.env.NODE_ENV,
      apiUrl: this.apiBaseUrl,
      wsUrl: this.wsBaseUrl,
      development: this.development.enableDevTools,
      version: process.env.REACT_APP_VERSION || '1.0.0'
    };
  }

  // 설정 검증
  validate() {
    const errors = [];

    if (!this.apiBaseUrl) {
      errors.push('API URL이 설정되지 않았습니다.');
    }

    if (!this.wsBaseUrl) {
      errors.push('WebSocket URL이 설정되지 않았습니다.');
    }

    if (this.fileUpload.maxSizeMB <= 0) {
      errors.push('파일 크기 제한이 올바르지 않습니다.');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// 싱글톤 인스턴스
const appConfig = new AppConfig();

// 설정 검증
const validation = appConfig.validate();
if (!validation.isValid) {
  console.error('설정 오류:', validation.errors);
}

// 개발 환경에서 환경 정보 출력
if (appConfig.development.enableDevTools) {
  console.log('앱 환경 정보:', appConfig.getEnvironmentInfo());
}

export default appConfig;
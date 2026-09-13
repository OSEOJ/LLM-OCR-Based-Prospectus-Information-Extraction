import os
import time
from typing import Dict, Optional
from fastapi import Request, Response, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response as StarletteResponse
import logging

logger = logging.getLogger(__name__)

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, requests_per_minute: int = 100):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.window_size = 60  # 1분
        self.client_requests: Dict[str, list] = {}
        self.websocket_connections: Dict[str, int] = {}  # WebSocket 연결 추적
        self.max_websocket_per_ip = int(os.getenv("MAX_WEBSOCKET_PER_IP", "5"))
    
    def get_client_ip(self, request: Request) -> str:
        """클라이언트 IP 주소 추출"""
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        return request.client.host if request.client else "unknown"
    
    async def dispatch(self, request: Request, call_next):
        client_ip = self.get_client_ip(request)
        current_time = time.time()
        
        # WebSocket 연결 체크
        if "/ws/" in str(request.url):
            if self.websocket_connections.get(client_ip, 0) >= self.max_websocket_per_ip:
                logger.warning(f"WebSocket connection limit exceeded for IP: {client_ip}")
                return StarletteResponse(
                    content="WebSocket connection limit exceeded",
                    status_code=429,
                    headers={"Retry-After": "60"}
                )
            self.websocket_connections[client_ip] = self.websocket_connections.get(client_ip, 0) + 1
        
        # 클라이언트별 요청 시간 기록 초기화
        if client_ip not in self.client_requests:
            self.client_requests[client_ip] = []
        
        # 윈도우 범위 밖의 오래된 요청 제거
        self.client_requests[client_ip] = [
            req_time for req_time in self.client_requests[client_ip]
            if current_time - req_time < self.window_size
        ]
        
        # 현재 요청 수 확인 (WebSocket은 별도 처리)
        if "/ws/" not in str(request.url) and len(self.client_requests[client_ip]) >= self.requests_per_minute:
            logger.warning(f"Rate limit exceeded for IP: {client_ip}")
            return StarletteResponse(
                content="Rate limit exceeded. Please try again later.",
                status_code=429,
                headers={"Retry-After": "60"}
            )
        
        # 현재 요청 시간 기록
        if "/ws/" not in str(request.url):
            self.client_requests[client_ip].append(current_time)
        
        response = await call_next(request)
        
        # WebSocket 연결 해제 시 카운트 감소 (정확한 구현을 위해서는 WebSocket 이벤트 핸들러 필요)
        return response

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """보안 헤더 추가 미들웨어"""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # 보안 헤더 추가
        security_headers = {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            "Content-Security-Policy": (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: blob:; "
                "font-src 'self'; "
                "connect-src 'self'; "
                "frame-ancestors 'none';"
            ),
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        }
        
        for header, value in security_headers.items():
            response.headers[header] = value
        
        return response

class FileValidationError(Exception):
    """파일 검증 오류"""
    pass

def validate_file_content(file_content: bytes, filename: str) -> bool:
    """파일 내용 검증 - 강화된 보안 검사"""
    try:
        # 파일 크기 검증
        max_size = int(os.getenv("MAX_FILE_SIZE_MB", "50")) * 1024 * 1024
        if len(file_content) > max_size:
            raise FileValidationError(f"파일 크기가 {max_size//1024//1024}MB를 초과합니다.")
        
        # 파일 확장자 검증
        allowed_extensions = os.getenv("ALLOWED_FILE_EXTENSIONS", "pdf,docx").split(",")
        file_ext = filename.lower().split('.')[-1] if '.' in filename else ""
        if file_ext not in allowed_extensions:
            raise FileValidationError(f"허용되지 않은 파일 형식입니다. 허용 형식: {', '.join(allowed_extensions)}")
        
        # 강화된 파일 시그니처 검증
        if not _validate_file_signature(file_content, file_ext):
            raise FileValidationError("파일 시그니처가 유효하지 않습니다.")
        
        # 최소 파일 크기 검증
        if len(file_content) < 100:
            raise FileValidationError("파일이 너무 작습니다.")
        
        # 악성 패턴 검사
        if _contains_malicious_patterns(file_content):
            raise FileValidationError("파일에 악성 패턴이 감지되었습니다.")
        
        return True
        
    except FileValidationError:
        raise
    except Exception as e:
        logger.error(f"파일 검증 중 오류: {str(e)}")
        raise FileValidationError("파일 검증 중 오류가 발생했습니다.")

def sanitize_filename(filename: str) -> str:
    """파일명 정화 및 보안 처리"""
    import re
    
    # 위험한 문자 제거
    filename = re.sub(r'[<>:"/\\|?*]', '', filename)
    
    # 경로 순회 방지
    filename = filename.replace('..', '')
    
    # 길이 제한 (255자)
    if len(filename) > 255:
        name, ext = os.path.splitext(filename)
        filename = name[:255-len(ext)] + ext
    
    # 빈 파일명 방지
    if not filename.strip():
        filename = "untitled"
    
    return filename.strip()

def validate_input_text(text: str, max_length: int = 100000) -> str:
    """입력 텍스트 검증 및 정화"""
    if not text or not isinstance(text, str):
        raise ValueError("유효하지 않은 텍스트입니다.")
    
    # 길이 제한
    if len(text) > max_length:
        raise ValueError(f"텍스트 길이가 {max_length}자를 초과합니다.")
    
    # 위험한 스크립트 태그 제거
    import re
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'javascript:', '', text, flags=re.IGNORECASE)
    
    return text.strip()

def _validate_file_signature(file_content: bytes, file_ext: str) -> bool:
    """강화된 파일 시그니처 검증"""
    file_signatures = {
        'pdf': {
            'headers': [b'%PDF-1.', b'%PDF-2.'],  # 더 구체적인 PDF 헤더
            'min_size': 1000,  # PDF 최소 크기
            'required_patterns': [b'%%EOF']  # PDF 파일 끝 패턴
        },
        'docx': {
            'headers': [b'PK\x03\x04'],  # ZIP 시그니처
            'min_size': 5000,  # DOCX 최소 크기
            'required_patterns': [b'word/', b'[Content_Types].xml']  # DOCX 내부 구조
        }
    }
    
    if file_ext not in file_signatures:
        return False
    
    sig_info = file_signatures[file_ext]
    
    # 헤더 검증
    if not any(file_content.startswith(header) for header in sig_info['headers']):
        return False
    
    # 크기 검증
    if len(file_content) < sig_info['min_size']:
        return False
    
    # 내부 패턴 검증 (처음 10KB만 검사)
    check_content = file_content[:10240]
    for pattern in sig_info.get('required_patterns', []):
        if pattern not in check_content and pattern not in file_content[-1024:]:  # 끝부분도 체크
            return False
    
    return True

def _contains_malicious_patterns(file_content: bytes) -> bool:
    """악성 패턴 검사"""
    # 처음 10KB만 검사하여 성능 최적화
    check_content = file_content[:10240].lower()
    
    malicious_patterns = [
        b'<script',
        b'javascript:',
        b'vbscript:',
        b'onload=',
        b'onerror=',
        b'eval(',
        b'document.write',
        b'<iframe',
        b'<embed',
        b'<object'
    ]
    
    return any(pattern in check_content for pattern in malicious_patterns)

def validate_base64_size(base64_data: str, max_size_mb: int = 50) -> bool:
    """Base64 데이터 크기 사전 검증"""
    # Base64 인코딩된 데이터의 예상 원본 크기 계산
    # Base64는 약 33% 크기 증가
    estimated_size = (len(base64_data) * 3) // 4
    max_size_bytes = max_size_mb * 1024 * 1024
    
    if estimated_size > max_size_bytes:
        raise FileValidationError(f"파일 크기가 {max_size_mb}MB를 초과합니다.")
    
    return True

def get_rate_limit_config() -> tuple:
    """환경변수에서 rate limit 설정 읽기"""
    requests = int(os.getenv("RATE_LIMIT_REQUESTS", "100"))
    window = int(os.getenv("RATE_LIMIT_WINDOW", "60"))
    return requests, window
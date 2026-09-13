"""통합 예외 처리 시스템"""

from typing import Optional, Dict, Any
from enum import Enum
import logging

logger = logging.getLogger(__name__)

class ErrorCode(Enum):
    """표준 에러 코드"""
    
    # 일반 에러 (1000-1999)
    UNKNOWN_ERROR = (1000, "Unknown error occurred")
    VALIDATION_ERROR = (1001, "Validation failed")
    CONFIGURATION_ERROR = (1002, "Configuration error")
    
    # 파일 관련 에러 (2000-2999)
    FILE_NOT_FOUND = (2000, "File not found")
    FILE_TOO_LARGE = (2001, "File size exceeds limit")
    FILE_INVALID_FORMAT = (2002, "Invalid file format")
    FILE_CORRUPTED = (2003, "File is corrupted")
    FILE_PROCESSING_ERROR = (2004, "File processing failed")
    
    # OCR 관련 에러 (3000-3999)
    OCR_INITIALIZATION_ERROR = (3000, "OCR service initialization failed")
    OCR_PROCESSING_ERROR = (3001, "OCR processing failed")
    OCR_NO_TEXT_FOUND = (3002, "No text found in document")
    OCR_TIMEOUT = (3003, "OCR processing timeout")
    
    # LLM 관련 에러 (4000-4999)
    LLM_API_ERROR = (4000, "LLM API error")
    LLM_RATE_LIMIT = (4001, "LLM API rate limit exceeded")
    LLM_TIMEOUT = (4002, "LLM processing timeout")
    LLM_INVALID_RESPONSE = (4003, "Invalid LLM response format")
    LLM_AUTHENTICATION_ERROR = (4004, "LLM API authentication failed")
    
    # 보안 관련 에러 (5000-5999)
    SECURITY_FILE_VALIDATION = (5000, "File security validation failed")
    SECURITY_RATE_LIMIT = (5001, "Rate limit exceeded")
    SECURITY_MALICIOUS_CONTENT = (5002, "Malicious content detected")
    SECURITY_UNAUTHORIZED = (5003, "Unauthorized access")
    
    # 스토리지 관련 에러 (6000-6999)
    STORAGE_FULL = (6000, "Storage capacity exceeded")
    STORAGE_PERMISSION = (6001, "Storage permission denied")
    STORAGE_CORRUPTION = (6002, "Storage corruption detected")
    
    def __init__(self, code: int, message: str):
        self.code = code
        self.message = message

class BaseApplicationError(Exception):
    """어플리케이션 기본 예외 클래스"""
    
    def __init__(
        self, 
        error_code: ErrorCode,
        details: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        original_exception: Optional[Exception] = None
    ):
        self.error_code = error_code
        self.details = details
        self.context = context or {}
        self.original_exception = original_exception
        
        # 기본 메시지 구성
        message = f"[{error_code.code}] {error_code.message}"
        if details:
            message += f": {details}"
        
        super().__init__(message)
    
    def to_dict(self) -> Dict[str, Any]:
        """예외를 딕셔너리로 변환"""
        return {
            "error_code": self.error_code.code,
            "error_message": self.error_code.message,
            "details": self.details,
            "context": self.context
        }
    
    def log_error(self, logger: logging.Logger):
        """에러 로깅"""
        error_dict = self.to_dict()
        logger.error(
            f"Application Error: {error_dict}",
            extra={"error_context": self.context},
            exc_info=self.original_exception
        )

class ValidationError(BaseApplicationError):
    """검증 실패 예외"""
    
    def __init__(self, field_name: str, details: str, value: Any = None):
        super().__init__(
            error_code=ErrorCode.VALIDATION_ERROR,
            details=f"Field '{field_name}': {details}",
            context={"field": field_name, "value": str(value) if value else None}
        )

class FileError(BaseApplicationError):
    """파일 관련 예외"""
    
    def __init__(self, error_code: ErrorCode, filename: str, details: Optional[str] = None):
        super().__init__(
            error_code=error_code,
            details=details,
            context={"filename": filename}
        )

class OCRError(BaseApplicationError):
    """OCR 관련 예외"""
    
    def __init__(self, error_code: ErrorCode, details: Optional[str] = None, page: Optional[int] = None):
        context = {}
        if page is not None:
            context["page"] = page
        
        super().__init__(
            error_code=error_code,
            details=details,
            context=context
        )

class LLMError(BaseApplicationError):
    """LLM 관련 예외"""
    
    def __init__(self, error_code: ErrorCode, details: Optional[str] = None, model: Optional[str] = None):
        context = {}
        if model:
            context["model"] = model
        
        super().__init__(
            error_code=error_code,
            details=details,
            context=context
        )

class SecurityError(BaseApplicationError):
    """보안 관련 예외"""
    
    def __init__(self, error_code: ErrorCode, details: Optional[str] = None, client_ip: Optional[str] = None):
        context = {}
        if client_ip:
            context["client_ip"] = client_ip
        
        super().__init__(
            error_code=error_code,
            details=details,
            context=context
        )

def handle_exception(
    exception: Exception, 
    logger: logging.Logger, 
    context: Optional[Dict[str, Any]] = None
) -> BaseApplicationError:
    """표준 예외 처리 핸들러"""
    
    # 이미 어플리케이션 예외인 경우
    if isinstance(exception, BaseApplicationError):
        exception.log_error(logger)
        return exception
    
    # 일반 예외를 어플리케이션 예외로 변환
    app_exception = BaseApplicationError(
        error_code=ErrorCode.UNKNOWN_ERROR,
        details=str(exception),
        context=context,
        original_exception=exception
    )
    
    app_exception.log_error(logger)
    return app_exception

def create_error_response(error: BaseApplicationError, include_details: bool = True) -> Dict[str, Any]:
    """API 응답용 에러 딕셔너리 생성"""
    response = {
        "status": "error",
        "error_code": error.error_code.code,
        "message": error.error_code.message
    }
    
    if include_details and error.details:
        response["details"] = error.details
    
    # 프로덕션 환경에서는 민감한 컨텍스트 정보 제외
    from config.settings import settings
    if not settings.is_production() and error.context:
        response["context"] = error.context
    
    return response
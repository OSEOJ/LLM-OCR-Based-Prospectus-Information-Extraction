import logging
import sys
from pathlib import Path
from logging.handlers import RotatingFileHandler
from typing import Optional
from config.settings import settings

class CustomFormatter(logging.Formatter):
    """커스텀 로그 포매터 - 로그 레벨에 따른 색상 구분"""
    
    COLORS = {
        logging.DEBUG: '\033[36m',    # 시안
        logging.INFO: '\033[37m',     # 흰색
        logging.WARNING: '\033[33m',  # 노란색
        logging.ERROR: '\033[31m',    # 빨간색
        logging.CRITICAL: '\033[35m', # 마젠타
    }
    RESET = '\033[0m'
    
    def format(self, record):
        log_message = super().format(record)
        return f"{self.COLORS.get(record.levelno, self.RESET)}{log_message}{self.RESET}"

def setup_logging(name: str = None) -> logging.Logger:
    """통합 로깅 설정 함수"""
    logger_name = name or __name__
    logger = logging.getLogger(logger_name)
    
    # 이미 설정된 로거는 재설정하지 않음
    if logger.handlers:
        return logger
    
    logger.setLevel(getattr(logging, settings.logging.level.upper()))
    
    # 콘솔 핸들러
    if settings.logging.enable_console:
        console_handler = logging.StreamHandler(sys.stdout)
        console_formatter = CustomFormatter(settings.logging.format)
        console_handler.setFormatter(console_formatter)
        logger.addHandler(console_handler)
    
    # 파일 핸들러
    if settings.logging.enable_file and settings.logging.file_path:
        # 로그 디렉터리 생성
        log_dir = settings.logging.file_path.parent
        log_dir.mkdir(parents=True, exist_ok=True)
        
        file_handler = RotatingFileHandler(
            filename=settings.logging.file_path,
            maxBytes=settings.logging.max_file_size_mb * 1024 * 1024,
            backupCount=settings.logging.backup_count,
            encoding='utf-8'
        )
        file_formatter = logging.Formatter(settings.logging.format)
        file_handler.setFormatter(file_formatter)
        logger.addHandler(file_handler)
    
    # 중복 로그 방지
    logger.propagate = False
    
    return logger

def get_logger(name: str) -> logging.Logger:
    """로거 인스턴스 반환"""
    return setup_logging(name)

# 서비스별 로거 생성 함수들
def get_ocr_logger() -> logging.Logger:
    return get_logger("ocr_service")

def get_llm_logger() -> logging.Logger:
    return get_logger("llm_service")

def get_file_logger() -> logging.Logger:
    return get_logger("file_service")

def get_security_logger() -> logging.Logger:
    return get_logger("security")

def get_api_logger() -> logging.Logger:
    return get_logger("api")

# 전역 로거 (하위 호환성)
logger = get_logger("app")
import os
from pathlib import Path
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field
from dotenv import load_dotenv

# .env file load
env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

@dataclass
class SecurityConfig:
    """Security related settings"""
    max_file_size_mb: int = field(default_factory=lambda: int(os.getenv("MAX_FILE_SIZE_MB", "50")))
    allowed_file_extensions: List[str] = field(default_factory=lambda: os.getenv("ALLOWED_FILE_EXTENSIONS", "pdf,docx").split(","))
    rate_limit_requests: int = field(default_factory=lambda: int(os.getenv("RATE_LIMIT_REQUESTS", "100")))
    rate_limit_window: int = field(default_factory=lambda: int(os.getenv("RATE_LIMIT_WINDOW", "60")))
    max_websocket_per_ip: int = field(default_factory=lambda: int(os.getenv("MAX_WEBSOCKET_PER_IP", "5")))
    max_text_length: int = field(default_factory=lambda: int(os.getenv("MAX_TEXT_LENGTH", "100000")))
    cors_origins: List[str] = field(default_factory=lambda: os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","))

@dataclass
class OCRConfig:
    """OCR related settings"""
    max_pages: int = field(default_factory=lambda: int(os.getenv("OCR_MAX_PAGES", "10")))
    dpi: int = field(default_factory=lambda: int(os.getenv("OCR_DPI", "300")))
    confidence_threshold: float = field(default_factory=lambda: float(os.getenv("OCR_CONFIDENCE_THRESHOLD", "0.6")))
    sort_by_position: bool = field(default_factory=lambda: os.getenv("OCR_SORT_BY_POSITION", "true").lower() == "true")
    use_gpu: bool = field(default_factory=lambda: os.getenv("OCR_USE_GPU", "false").lower() == "true")
    supported_languages: List[str] = field(default_factory=lambda: os.getenv("OCR_LANGUAGES", "ko,en").split(","))

@dataclass  
class LLMConfig:
    """LLM related settings"""
    openai_api_key: str = field(default_factory=lambda: os.getenv("OPENAI_API_KEY", ""))
    model_name: str = field(default_factory=lambda: os.getenv("OPENAI_MODEL", "gpt-4"))
    max_tokens: int = field(default_factory=lambda: int(os.getenv("LLM_MAX_TOKENS", "4000")))
    temperature: float = field(default_factory=lambda: float(os.getenv("LLM_TEMPERATURE", "0.1")))
    timeout_seconds: int = field(default_factory=lambda: int(os.getenv("LLM_TIMEOUT", "60")))
    retry_attempts: int = field(default_factory=lambda: int(os.getenv("LLM_RETRY_ATTEMPTS", "3")))
    
    def __post_init__(self):
        if not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY is required but not provided")

@dataclass
class StorageConfig:
    """Storage related settings"""
    temp_dir: Path = field(default_factory=lambda: Path(os.getenv("TEMP_DIR", "./temp")))
    output_dir: Path = field(default_factory=lambda: Path(os.getenv("OUTPUT_DIR", "./output")))
    max_storage_mb: int = field(default_factory=lambda: int(os.getenv("MAX_STORAGE_MB", "1000")))
    cleanup_older_than_days: int = field(default_factory=lambda: int(os.getenv("CLEANUP_DAYS", "7")))
    auto_cleanup: bool = field(default_factory=lambda: os.getenv("AUTO_CLEANUP", "true").lower() == "true")
    
    def __post_init__(self):
        # Create directories
        self.temp_dir.mkdir(exist_ok=True)
        self.output_dir.mkdir(exist_ok=True)

@dataclass
class ServerConfig:
    """Server related settings"""
    host: str = field(default_factory=lambda: os.getenv("SERVER_HOST", "0.0.0.0"))
    port: int = field(default_factory=lambda: int(os.getenv("SERVER_PORT", "8000")))
    debug: bool = field(default_factory=lambda: os.getenv("DEBUG", "false").lower() == "true")
    reload: bool = field(default_factory=lambda: os.getenv("RELOAD", "true").lower() == "true")
    log_level: str = field(default_factory=lambda: os.getenv("LOG_LEVEL", "info"))
    workers: int = field(default_factory=lambda: int(os.getenv("WORKERS", "1")))

@dataclass
class LoggingConfig:
    """Logging related settings"""
    level: str = field(default_factory=lambda: os.getenv("LOG_LEVEL", "INFO"))
    format: str = field(default_factory=lambda: os.getenv("LOG_FORMAT", "%(asctime)s - %(name)s - %(levelname)s - %(message)s"))
    file_path: Optional[Path] = field(default_factory=lambda: Path(os.getenv("LOG_FILE", "")) if os.getenv("LOG_FILE") else None)
    max_file_size_mb: int = field(default_factory=lambda: int(os.getenv("LOG_MAX_SIZE_MB", "100")))
    backup_count: int = field(default_factory=lambda: int(os.getenv("LOG_BACKUP_COUNT", "5")))
    enable_console: bool = field(default_factory=lambda: os.getenv("LOG_CONSOLE", "true").lower() == "true")
    enable_file: bool = field(default_factory=lambda: os.getenv("LOG_FILE_ENABLED", "false").lower() == "true")

class Settings:
    """Unified settings management class"""
    
    def __init__(self):
        self.security = SecurityConfig()
        self.ocr = OCRConfig()
        self.llm = LLMConfig()
        self.storage = StorageConfig()
        self.server = ServerConfig()
        self.logging = LoggingConfig()
        
        # Settings validation
        self._validate_settings()
    
    def _validate_settings(self):
        """Settings validation"""
        # LLM API key validation
        if not self.llm.openai_api_key:
            raise ValueError("OpenAI API key is required")
        
        # File size limit validation
        if self.security.max_file_size_mb <= 0:
            raise ValueError("Max file size must be positive")
        
        # OCR settings validation
        if self.ocr.max_pages <= 0:
            raise ValueError("OCR max pages must be positive")
        
        if not (0.0 <= self.ocr.confidence_threshold <= 1.0):
            raise ValueError("OCR confidence threshold must be between 0 and 1")
    
    def get_env_info(self) -> Dict[str, Any]:
        """Return environment info (excluding sensitive information)"""
        return {
            "debug_mode": self.server.debug,
            "max_file_size_mb": self.security.max_file_size_mb,
            "allowed_extensions": self.security.allowed_file_extensions,
            "ocr_max_pages": self.ocr.max_pages,
            "ocr_languages": self.ocr.supported_languages,
            "llm_model": self.llm.model_name,
            "storage_auto_cleanup": self.storage.auto_cleanup
        }
    
    def is_production(self) -> bool:
        """Check if production environment"""
        return not self.server.debug
    
    def get_cors_origins(self) -> List[str]:
        """Get CORS allowed origins list"""
        return [origin.strip() for origin in self.security.cors_origins]

# Global settings instance
settings = Settings()
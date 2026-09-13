import os
import shutil
import tempfile
from pathlib import Path
from typing import List, Optional
import asyncio
import json
from datetime import datetime

from fastapi import FastAPI, File, UploadFile, HTTPException, Form, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
import uvicorn

# 새로운 로깅 및 예외 처리 시스템
from utils.logger import get_api_logger
from utils.exceptions import (
    BaseApplicationError, FileError, SecurityError, ErrorCode,
    handle_exception, create_error_response
)

logger = get_api_logger()

# 중앙집중식 설정 시스템 로드
from config.settings import settings

# 처리 모듈들 임포트
from services.ocr_service import OCRService
from services.llm_service import LLMService
from services.file_service import FileService

# 보안 미들웨어 임포트
from middleware.security import (
    RateLimitMiddleware, 
    SecurityHeadersMiddleware,
    validate_file_content,
    sanitize_filename,
    validate_input_text,
    validate_base64_size,
    get_rate_limit_config
)

app = FastAPI(
    title="PDF to JSON Converter API",
    description="PDF 파일을 OCR로 텍스트 변환 후 LLM을 통해 JSON으로 변환하는 API",
    version="1.0.0"
)

# 보안 미들웨어 추가
app.add_middleware(RateLimitMiddleware, requests_per_minute=settings.security.rate_limit_requests)
app.add_middleware(SecurityHeadersMiddleware)

# CORS 설정 - 중앙 설정에서 허용된 오리진 로드
allowed_origins = settings.get_cors_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept"],
)

# 서비스 인스턴스 전역 변수 (지연 초기화)
ocr_service = None
llm_service = None
file_service = None

def get_ocr_service():
    """OCR 서비스 지연 초기화"""
    global ocr_service
    if ocr_service is None:
        ocr_service = OCRService()
    return ocr_service

def get_llm_service():
    """LLM 서비스 지연 초기화"""
    global llm_service
    if llm_service is None:
        llm_service = LLMService()
    return llm_service

def get_file_service():
    """파일 서비스 지연 초기화"""
    global file_service
    if file_service is None:
        file_service = FileService()
    return file_service

class ConversionRequest(BaseModel):
    product_type: str = "bond_forward"  # bond_forward 또는 FRN
    version: Optional[str] = None

class ConversionResult(BaseModel):
    status: str
    message: str
    file_id: Optional[str] = None
    original_filename: Optional[str] = None
    txt_content: Optional[str] = None
    json_result: Optional[dict] = None
    field_mappings: Optional[list] = None
    processing_time: Optional[float] = None
    error: Optional[str] = None

@app.get("/")
async def root():
    return {"message": "PDF to JSON Converter API", "status": "running"}

@app.get("/health")
async def health_check():
    # 헬스체크는 빠르게 응답 (서비스 초기화 없이)
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "message": "Server is running. Services will initialize on first use."
    }

@app.post("/api/convert", response_model=ConversionResult)
async def convert_pdf_to_json(
    file: UploadFile = File(...),
    product_type: str = Form(default="bond_forward"),
    version: Optional[str] = Form(default=None)
):
    """PDF 파일을 업로드하여 OCR → LLM → JSON으로 변환"""
    start_time = datetime.now()
    temp_dir = None
    
    try:
        # 파일 검증
        if not file.filename:
            raise HTTPException(status_code=400, detail="파일 이름이 없습니다.")
        
        # 파일명 정화
        safe_filename = sanitize_filename(file.filename)
        
        # 파일 내용 읽기 및 검증
        file_content = await file.read()
        try:
            validate_file_content(file_content, safe_filename)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        # 임시 파일 저장
        temp_dir = tempfile.mkdtemp()
        file_path = os.path.join(temp_dir, safe_filename)
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # 파일 처리
        processing_method = get_file_service().determine_processing_method(file_path)
        txt_content = await get_ocr_service().process_file_with_method(file_path, processing_method)
        
        if not txt_content or not txt_content.strip():
            raise HTTPException(status_code=400, detail="파일에서 텍스트를 추출할 수 없습니다.")
        
        # LLM 변환 (매핑 정보 포함으로 변경)
        llm_result = await get_llm_service().text_to_json(txt_content, product_type, version, with_mapping=True)
        processing_time = (datetime.now() - start_time).total_seconds()
        
        # 결과에서 JSON과 매핑 정보 분리
        if isinstance(llm_result, dict) and "json_result" in llm_result:
            json_result = llm_result["json_result"]
            field_mappings = llm_result.get("field_mappings", [])
        else:
            json_result = llm_result
            field_mappings = []
        
        # 결과 저장
        file_id = get_file_service().save_conversion_result(
            original_filename=file.filename,
            txt_content=txt_content,
            json_result=json_result,
            product_type=product_type
        )
        
        return ConversionResult(
            status="success",
            message="변환이 완료되었습니다.",
            file_id=file_id,
            original_filename=file.filename,
            txt_content=txt_content,
            json_result=json_result,
            field_mappings=field_mappings,
            processing_time=processing_time
        )
        
    except HTTPException:
        raise
    except Exception as e:
        app_error = handle_exception(
            e, logger, 
            context={"operation": "pdf_conversion", "filename": file.filename}
        )
        return ConversionResult(
            status="error",
            message="변환 중 오류가 발생했습니다.",
            error=str(app_error),
            processing_time=(datetime.now() - start_time).total_seconds()
        )
    
    finally:
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)

@app.get("/api/download/{file_id}")
async def download_result(file_id: str, format: str = "json"):
    """변환 결과를 다운로드 (json 또는 txt 형식)"""
    file_path = get_file_service().get_result_file_path(file_id, format)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    
    media_type = "application/json" if format == "json" else "text/plain"
    filename = f"{file_id}.{format}"
    
    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=filename
    )

@app.get("/api/supported-products")
async def get_supported_products():
    """지원되는 상품 타입과 버전 목록 반환"""
    products = get_llm_service().get_supported_products()
    return {"products": products}

@app.post("/api/convert-with-mapping", response_model=ConversionResult)
async def convert_with_mapping(
    file: UploadFile = File(...),
    product_type: str = Form("bond_forward"),
    version: Optional[str] = Form(None)
):
    """매핑 정보와 함께 PDF/DOCX를 JSON으로 변환"""
    try:
        start_time = datetime.now()
        
        # 파일 유효성 검증
        if not file.filename:
            raise HTTPException(status_code=400, detail="파일명이 없습니다.")
            
        file_extension = Path(file.filename).suffix.lower()
        if file_extension not in ['.pdf', '.docx']:
            raise HTTPException(status_code=400, detail="PDF 또는 DOCX 파일만 지원됩니다.")
        
        # 파일 내용 검증
        file_content = await file.read()
        await file.seek(0)  # 파일 포인터 리셋
        
        if not validate_file_content(file_content, file_extension):
            raise HTTPException(status_code=400, detail="유효하지 않은 파일 형식입니다.")
        
        # 텍스트 추출
        txt_content = await get_file_service().extract_text_from_file(file, file_extension)
        
        if not txt_content or not txt_content.strip():
            raise HTTPException(status_code=400, detail="파일에서 텍스트를 추출할 수 없습니다.")
        
        # LLM 변환 (매핑 정보 포함)
        llm_result = await get_llm_service().text_to_json(txt_content, product_type, version, with_mapping=True)
        processing_time = (datetime.now() - start_time).total_seconds()
        
        # 결과에서 JSON과 매핑 정보 분리
        if isinstance(llm_result, dict) and "json_result" in llm_result:
            json_result = llm_result["json_result"]
            field_mappings = llm_result.get("field_mappings", [])
        else:
            json_result = llm_result
            field_mappings = []
        
        # 결과 저장
        file_id = get_file_service().save_conversion_result(
            original_filename=file.filename,
            txt_content=txt_content,
            json_result=json_result,
            product_type=product_type
        )
        
        return ConversionResult(
            status="success",
            message="매핑 정보와 함께 변환이 완료되었습니다.",
            file_id=file_id,
            original_filename=file.filename,
            txt_content=txt_content,
            json_result=json_result,
            field_mappings=field_mappings,
            processing_time=processing_time
        )
        
    except HTTPException:
        raise
    except Exception as e:
        app_error = handle_exception(
            e, logger,
            context={"operation": "mapping_conversion", "filename": file.filename}
        )
        return ConversionResult(
            status="error",
            message="매핑 변환 중 오류가 발생했습니다.",
            error=str(app_error)
        )

@app.post("/api/convert-text")
async def convert_text_to_json(
    text: str = Form(...),
    product_type: str = Form(default="bond_forward"),
    version: Optional[str] = Form(default=None)
):
    """텍스트를 직접 입력하여 JSON으로 변환"""
    start_time = datetime.now()
    
    try:
        # 입력 텍스트 검증
        validated_text = validate_input_text(text)
        
        json_result = await get_llm_service().text_to_json(validated_text, product_type, version)
        processing_time = (datetime.now() - start_time).total_seconds()
        
        return ConversionResult(
            status="success",
            message="텍스트 변환이 완료되었습니다.",
            txt_content=validated_text,
            json_result=json_result,
            processing_time=processing_time
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/ocr-preview")
async def ocr_preview(file: UploadFile = File(...)):
    """파일 업로드 시 전체 OCR을 진행하고 변환율 정보를 반환"""
    start_time = datetime.now()
    temp_dir = None
    
    try:
        # 파일 검증
        if not file.filename:
            raise HTTPException(status_code=400, detail="파일 이름이 없습니다.")
        
        # 파일명 정화
        safe_filename = sanitize_filename(file.filename)
        
        # 파일 내용 읽기 및 검증
        file_content = await file.read()
        try:
            validate_file_content(file_content, safe_filename)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        # 임시 파일 저장
        temp_dir = tempfile.mkdtemp()
        pdf_path = os.path.join(temp_dir, safe_filename)
        with open(pdf_path, "wb") as f:
            f.write(file_content)
        
        # OCR 실행
        ocr_result = await get_ocr_service().ocr_preview(pdf_path)
        processing_time = (datetime.now() - start_time).total_seconds()
        
        return {
            "status": "success",
            "filename": safe_filename,
            "total_pages": ocr_result["total_pages"],
            "successful_pages": ocr_result["successful_pages"],
            "success_rate": ocr_result["success_rate"],
            "page_results": ocr_result["page_results"],
            "processing_time": processing_time,
            "preview_text": ocr_result.get("preview_text", "")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        app_error = handle_exception(
            e, logger,
            context={"operation": "ocr_preview", "filename": safe_filename}
        )
        return {
            "status": "error", 
            "message": f"OCR 프리뷰 중 오류가 발생했습니다: {str(app_error)}",
            "processing_time": (datetime.now() - start_time).total_seconds()
        }
    
    finally:
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)

@app.get("/api/status")
async def get_status():
    """시스템 상태 및 통계 정보 반환"""
    recent_results = get_file_service().list_conversion_results(limit=10)
    storage_info = get_file_service().get_storage_info()
    
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "ocr": get_ocr_service().is_ready(),
            "llm": get_llm_service().is_ready(),
            "file": get_file_service().is_ready()
        },
        "statistics": {
            "total_conversions": len(recent_results),
            "storage_info": storage_info
        },
        "recent_conversions": recent_results
    }

@app.websocket("/ws/ocr-batch")
async def websocket_ocr_batch(websocket: WebSocket):
    """여러 파일의 병렬 OCR 처리를 위한 WebSocket"""
    await websocket.accept()
    temp_dirs = []
    tasks = {}

    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")

            if action == "start_batch":
                files_data = data.get("files", [])
                if not files_data:
                    await websocket.send_json({"type": "error", "data": {"message": "No files provided"}})
                    continue

                for file_info in files_data:
                    file_id = file_info.get("file_id")
                    file_data = file_info.get("file_data")
                    if not file_id or not file_data:
                        continue
                    tasks[file_id] = asyncio.create_task(
                        _process_batch_file(
                            websocket, file_id,
                            file_info.get("filename", "uploaded_file"),
                            file_data, temp_dirs
                        )
                    )

            elif action == "cancel_file":
                file_id = data.get("file_id")
                task = tasks.pop(file_id, None)
                if task:
                    task.cancel()
                    await websocket.send_json({"type": "cancelled", "data": {"file_id": file_id}})

            elif action == "cancel_all":
                for task in tasks.values():
                    task.cancel()
                tasks.clear()
                await websocket.send_json({"type": "all_cancelled", "data": {}})

    except WebSocketDisconnect:
        logger.info("배치 OCR WebSocket 연결 종료")

    except Exception as e:
        handle_exception(e, logger, context={"operation": "websocket_ocr_batch"})

    finally:
        for task in tasks.values():
            task.cancel()
        for temp_dir in temp_dirs:
            if temp_dir and os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)


async def _process_batch_file(websocket: WebSocket, file_id: str, filename: str,
                              file_data: str, temp_dirs: list):
    """배치 내 개별 파일 처리. /ws/ocr-preview와 같은 파이프라인에 file_id만 태깅한다."""
    clean_id = str(file_id)
    safe_filename = sanitize_filename(filename)

    try:
        validate_base64_size(file_data, max_size_mb=settings.security.max_file_size_mb)

        import base64
        file_content = base64.b64decode(file_data)
        validate_file_content(file_content, safe_filename)

        temp_dir = tempfile.mkdtemp()
        temp_dirs.append(temp_dir)
        file_path = os.path.join(temp_dir, safe_filename)
        with open(file_path, "wb") as f:
            f.write(file_content)

        async def progress_callback(progress_data):
            progress_data["file_id"] = clean_id
            await websocket.send_json({"type": "file_progress", "data": progress_data})

        processing_method = get_file_service().determine_processing_method(file_path)

        if processing_method == "ocr":
            result = await get_ocr_service().ocr_preview(file_path, progress_callback)
        else:
            await progress_callback({
                "current": 1, "total": 1, "page_number": 1,
                "status": "processing", "message": "텍스트 추출 중..."
            })
            txt_content = await get_ocr_service().process_file_with_method(file_path, processing_method)
            result = {
                "total_pages": 1,
                "successful_pages": 1,
                "success_rate": 100.0,
                "page_results": [{"page": 1, "status": "success", "text_length": len(txt_content)}],
                "preview_text": txt_content or "",
            }

        await websocket.send_json({
            "type": "file_complete",
            "data": {
                "file_id": clean_id,
                "status": "success",
                "filename": safe_filename,
                "processing_method": processing_method,
                **result,
            },
        })

    except asyncio.CancelledError:
        raise
    except Exception as e:
        app_error = handle_exception(
            e, logger,
            context={"operation": "websocket_ocr_batch_file", "filename": safe_filename}
        )
        await websocket.send_json({
            "type": "file_error",
            "data": {"file_id": clean_id, "message": str(app_error)}
        })


@app.websocket("/ws/ocr-preview")
async def websocket_ocr_preview(websocket: WebSocket):
    """WebSocket을 통한 실시간 OCR 진행률 전송"""
    await websocket.accept()
    temp_dir = None
    
    try:
        # 클라이언트로부터 파일 데이터 수신
        data = await websocket.receive_json()
        
        if data.get("action") != "start_ocr" or "file_data" not in data:
            await websocket.send_json({"type": "error", "data": {"message": "Invalid request format"}})
            return
            
        file_data = data["file_data"]
        filename = data.get("filename", "uploaded_file")
        
        # 파일명 정화 및 검증
        safe_filename = sanitize_filename(filename)
        
        # Base64 크기 사전 검증
        validate_base64_size(file_data, max_size_mb=settings.security.max_file_size_mb)
        
        # Base64 디코딩 및 파일 저장
        import base64
        try:
            file_content = base64.b64decode(file_data)
        except Exception as e:
            await websocket.send_json({"type": "error", "data": {"message": "유효하지 않은 파일 데이터입니다."}})
            return
        
        # 파일 내용 검증
        try:
            validate_file_content(file_content, safe_filename)
        except Exception as e:
            await websocket.send_json({"type": "error", "data": {"message": str(e)}})
            return
        
        temp_dir = tempfile.mkdtemp()
        file_path = os.path.join(temp_dir, safe_filename)
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # 진행률 콜백 함수
        async def progress_callback(progress_data):
            await websocket.send_json({"type": "progress", "data": progress_data})
        
        # 파일 처리
        processing_method = get_file_service().determine_processing_method(file_path)
        
        if processing_method == "ocr":
            ocr_result = await get_ocr_service().ocr_preview(file_path, progress_callback)
            
            await websocket.send_json({
                "type": "complete",
                "data": {
                    "status": "success",
                    "filename": safe_filename,
                    "processing_method": processing_method,
                    "total_pages": ocr_result["total_pages"],
                    "successful_pages": ocr_result["successful_pages"],
                    "success_rate": ocr_result["success_rate"],
                    "page_results": ocr_result["page_results"],
                    "preview_text": ocr_result.get("preview_text", "")
                }
            })
        else:
            # 텍스트 직접 추출
            await progress_callback({
                "current": 1, "total": 1, "page_number": 1, 
                "status": "processing", "message": "텍스트 추출 중..."
            })
            
            txt_content = await get_ocr_service().process_file_with_method(file_path, processing_method)
            
            await websocket.send_json({
                "type": "complete",
                "data": {
                    "status": "success",
                    "filename": safe_filename,
                    "processing_method": processing_method,
                    "total_pages": 1,
                    "successful_pages": 1,
                    "success_rate": 100.0,
                    "page_results": [{"page": 1, "status": "success", "text_length": len(txt_content)}],
                    "preview_text": txt_content if txt_content else ""
                }
            })
        
    except Exception as e:
        app_error = handle_exception(
            e, logger,
            context={"operation": "websocket_ocr", "filename": safe_filename}
        )
        await websocket.send_json({"type": "error", "data": {"message": str(app_error)}})
    
    finally:
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)

if __name__ == "__main__":
    # 설정 검증 및 환경 정보 출력
    logger.info(f"Starting server with configuration: {settings.get_env_info()}")
    
    uvicorn.run(
        "main:app",
        host=settings.server.host,
        port=settings.server.port,
        reload=settings.server.reload,
        log_level=settings.server.log_level,
        workers=settings.server.workers if not settings.server.reload else 1
    )

import os
import cv2
import numpy as np
from pdf2image import convert_from_path
from PIL import Image
import easyocr
import asyncio
import gc
from typing import List, Optional, Dict, Any
from pathlib import Path

# 새로운 로깅 및 예외 처리 시스템
from utils.logger import get_ocr_logger
from utils.exceptions import OCRError, ErrorCode, handle_exception
from config.settings import settings

logger = get_ocr_logger()

class OCRService:
    def __init__(self):
        self.reader = None
        self._initialize_reader()
    
    def _initialize_reader(self):
        """EasyOCR 리더 초기화"""
        try:
            # 중앙 설정에서 OCR 구성 로드
            languages = settings.ocr.supported_languages
            use_gpu = settings.ocr.use_gpu
            
            os.environ["TOKENIZERS_PARALLELISM"] = "false"
            self.reader = easyocr.Reader(lang_list=languages, gpu=use_gpu)
            logger.info(f"OCR 리더 초기화 완료 - 언어: {languages}, GPU: {use_gpu}")
        except Exception as e:
            error = OCRError(
                error_code=ErrorCode.OCR_INITIALIZATION_ERROR,
                details=f"EasyOCR 리더 초기화 실패: {str(e)}"
            )
            error.log_error(logger)
            self.reader = None
            raise error
    
    def is_ready(self) -> bool:
        """OCR 서비스 준비 상태 확인"""
        return self.reader is not None
    
    def preprocess_image(self, img: Image.Image) -> Image.Image:
        """이미지 전처리"""
        try:
            img_array = np.array(img)
            
            # 컬러 이미지인 경우에만 처리
            if len(img_array.shape) == 3:
                # HSV 색상 공간으로 변환
                hsv = cv2.cvtColor(img_array, cv2.COLOR_RGB2HSV)
                
                # 노란색 범위 정의 - 첨부된 이미지의 노란색에 맞게 조정
                lower_yellow = np.array([20, 100, 180])
                upper_yellow = np.array([35, 255, 255])
                
                # 노란색 마스크 생성
                yellow_mask = cv2.inRange(hsv, lower_yellow, upper_yellow)
                
                # 마스크를 적용하여 노란색 부분을 흰색으로 변경
                result = img_array.copy()
                result[yellow_mask > 0] = [255, 255, 255]
                
                # 그레이스케일로 변환
                gray = cv2.cvtColor(result, cv2.COLOR_RGB2GRAY)
            else:
                gray = img_array
            
            # 이진화
            _, binary = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
            
            # 노이즈 제거
            denoised = cv2.fastNlMeansDenoising(binary, None, 10, 7, 21)
            
            # 샤프닝
            kernel = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])
            sharpened = cv2.filter2D(denoised, -1, kernel)
            
            processed_img = Image.fromarray(sharpened)
            return processed_img
            
        except Exception as e:
            error = handle_exception(
                e, logger, 
                context={"operation": "image_preprocessing"}
            )
            logger.warning(f"이미지 전처리 실패, 원본 이미지 사용: {str(e)}")
            return img
    
    def detect_tables(self, image: Image.Image) -> List[tuple]:
        """이미지에서 표 영역 감지"""
        try:
            img_array = np.array(image)
            gray = img_array
            
            if gray.dtype != np.uint8:
                gray = gray.astype(np.uint8)
            
            threshold = 255 - gray
            
            # 수평/수직 라인 감지
            horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (40, 1))
            vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 40))
            
            horizontal_lines = cv2.morphologyEx(threshold, cv2.MORPH_OPEN, horizontal_kernel, iterations=1)
            vertical_lines = cv2.morphologyEx(threshold, cv2.MORPH_OPEN, vertical_kernel, iterations=1)
            
            # 표 테두리 감지
            table_boundaries = cv2.addWeighted(horizontal_lines, 0.5, vertical_lines, 0.5, 0.0)
            
            # 테두리에서 표 영역 찾기
            contours, _ = cv2.findContours(table_boundaries, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            table_regions = []
            for contour in contours:
                x, y, w, h = cv2.boundingRect(contour)
                if w > 100 and h > 100:  # 작은 영역 필터링
                    table_regions.append((x, y, x+w, y+h))
            
            return table_regions
        except Exception as e:
            print(f"표 감지 중 오류: {str(e)}")
            return []
    
    def parse_ocr_detection(self, detection) -> Optional[dict]:
        """OCR 감지 결과 파싱"""
        try:
            if len(detection) < 2:
                return None
            
            bbox, text = detection[0], detection[1]
            confidence = detection[2] if len(detection) > 2 else 1.0
            
            if not text or not text.strip():
                return None
            
            # bbox는 4개 점의 좌표
            points = np.array(bbox, dtype=np.int32)
            x_min, y_min = points.min(axis=0)
            x_max, y_max = points.max(axis=0)
            x_center = int(np.mean(points[:, 0]))
            y_center = int(np.mean(points[:, 1]))
            
            return {
                'text': text.strip(),
                'x_center': x_center,
                'y_center': y_center,
                'x_min': x_min,
                'y_min': y_min,
                'x_max': x_max,
                'y_max': y_max,
                'bbox': bbox,
                'confidence': confidence
            }
        except Exception as e:
            print(f"OCR 결과 파싱 중 오류: {str(e)}")
            return None
    
    def sort_ocr_results(self, result: List, image: Image.Image) -> List[str]:
        """OCR 결과를 표와 비표 영역으로 구분하여 정렬하고 적절한 줄바꿈 처리"""
        try:
            # 표 영역 감지
            table_regions = self.detect_tables(image)
            
            # OCR 결과 파싱
            parsed_results = []
            for detection in result:
                parsed = self.parse_ocr_detection(detection)
                if parsed is None:
                    continue
                
                # 표 영역에 속하는지 확인
                parsed['in_table'] = self._is_text_in_table(
                    parsed['x_center'], parsed['y_center'], table_regions
                )
                parsed_results.append(parsed)
            
            if not parsed_results:
                return []
            
            # 표 영역과 비표 영역 분리
            table_texts = [item for item in parsed_results if item['in_table']]
            non_table_texts = [item for item in parsed_results if not item['in_table']]
            
            final_output = []
            
            # 비표 텍스트 처리: Y 좌표 기반으로 행 그룹화
            if non_table_texts:
                # Y 좌표로 정렬
                non_table_texts.sort(key=lambda x: x['y_center'])
                
                # 행 그룹화
                row_groups = []
                current_row = []
                row_tolerance = 25  # Y 좌표 허용 오차
                
                for item in non_table_texts:
                    if not current_row:
                        current_row = [item]
                    else:
                        # 현재 행의 평균 Y 좌표
                        current_y_avg = sum(t['y_center'] for t in current_row) / len(current_row)
                        
                        if abs(item['y_center'] - current_y_avg) <= row_tolerance:
                            # 같은 행으로 판단
                            current_row.append(item)
                        else:
                            # 새로운 행 시작
                            if current_row:
                                row_groups.append(current_row)
                            current_row = [item]
                
                # 마지막 행 추가
                if current_row:
                    row_groups.append(current_row)
                
                # 각 행 내에서 X 좌표로 정렬하고 텍스트 결합
                for row_group in row_groups:
                    # X 좌표로 정렬
                    row_group.sort(key=lambda x: x['x_center'])
                    
                    # 텍스트 결합
                    row_texts = []
                    for item in row_group:
                        text = item['text'].strip()
                        if text:
                            row_texts.append(text)
                    
                    if row_texts:
                        # 같은 행 내의 텍스트들을 적절한 간격으로 연결
                        row_text = ' '.join(row_texts)
                        final_output.append(row_text)
            
            # 표 텍스트 처리 (기존 방식 유지하되 개선)
            if table_texts:
                # Y 좌표로 정렬
                table_texts.sort(key=lambda x: x['y_center'])
                for item in table_texts:
                    text = item['text'].strip()
                    if text:
                        final_output.append(text)
            
            return final_output
            
        except Exception as e:
            print(f"OCR 결과 정렬 중 오류: {str(e)}")
            # 오류 시 기본 정렬
            return [detection[1] for detection in result if len(detection) > 1 and detection[1].strip()]
    
    def _is_text_in_table(self, x_center: int, y_center: int, table_regions: List[tuple]) -> bool:
        """텍스트가 표 영역에 속하는지 확인"""
        for table_region in table_regions:
            tx1, ty1, tx2, ty2 = table_region
            if (x_center >= tx1 and x_center <= tx2 and 
                y_center >= ty1 and y_center <= ty2):
                return True
        return False
    
    async def pdf_to_text(self, pdf_path: str) -> str:
        """PDF 파일을 텍스트로 변환"""
        if not self.is_ready():
            raise Exception("OCR 서비스가 초기화되지 않았습니다.")
        
        try:
            # PDF 파일 유효성 검사
            if not os.path.exists(pdf_path):
                raise Exception(f"PDF 파일이 존재하지 않습니다: {pdf_path}")
            
            # PDF를 이미지로 변환
            print(f"PDF를 이미지로 변환 중: {pdf_path}")
            try:
                images = convert_from_path(pdf_path, dpi=300, first_page=1, last_page=20)  # 최대 20페이지로 제한
            except Exception as convert_error:
                logger.error(f"PDF 이미지 변환 실패: {convert_error}")
                raise Exception(f"PDF를 이미지로 변환할 수 없습니다: {str(convert_error)}")
            
            if not images:
                raise Exception("PDF에서 이미지를 추출할 수 없습니다.")
            
            print(f"변환된 이미지 수: {len(images)}페이지")
            
            # 각 이미지 전처리
            processed_images = []
            for i, img in enumerate(images):
                try:
                    processed_img = self.preprocess_image(img)
                    processed_images.append(processed_img)
                except Exception as preprocess_error:
                    logger.warning(f"페이지 {i+1} 전처리 실패: {preprocess_error}")
                    # 전처리 실패 시 원본 이미지 사용
                    processed_images.append(img)
            
            all_texts = []
            
            # 각 페이지에 대해 OCR 수행
            for i, img in enumerate(processed_images):
                try:
                    print(f"페이지 {i+1}/{len(processed_images)} OCR 처리 중...")
                    
                    # OCR 실행
                    result = self.reader.readtext(
                        np.array(img),
                        text_threshold=0.7,
                        low_text=0.4,
                        slope_ths=0.1,
                        width_ths=0.6,
                        paragraph=False,
                        link_threshold=0.3,
                    )
                    
                    # 정렬
                    sorted_page_text_list = self.sort_ocr_results(result, img)
                    sorted_page_text = '\n'.join(sorted_page_text_list)
                    
                    if sorted_page_text.strip():
                        all_texts.append(sorted_page_text)
                    else:
                        logger.warning(f"페이지 {i+1}에서 텍스트를 추출하지 못했습니다.")
                        all_texts.append(f"[페이지 {i+1}: 텍스트 없음]")
                        
                except Exception as ocr_error:
                    logger.error(f"페이지 {i+1} OCR 처리 실패: {ocr_error}")
                    all_texts.append(f"[페이지 {i+1}: OCR 실패]")
                    continue
            
            # 전체 텍스트 결합
            if not all_texts:
                raise Exception("어떤 페이지에서도 텍스트를 추출할 수 없습니다.")
            
            final_text = '\n\n===== 페이지 구분선 =====\n\n'.join(all_texts)
            print(f"OCR 처리 완료: {len(processed_images)}페이지")
            
            return final_text
            
        except Exception as e:
            logger.error(f"PDF → 텍스트 변환 중 오류: {str(e)}")
            raise Exception(f"OCR 처리 실패: {str(e)}")
    
    async def image_to_text(self, image_path: str) -> str:
        """이미지 파일을 텍스트로 변환"""
        if not self.is_ready():
            raise Exception("OCR 서비스가 초기화되지 않았습니다.")
        
        try:
            # 이미지 로드 및 전처리
            img = Image.open(image_path)
            processed_img = self.preprocess_image(img)
            
            # OCR 실행
            result = self.reader.readtext(
                np.array(processed_img),
                text_threshold=0.7,
                low_text=0.4,
                slope_ths=0.1,
                width_ths=0.6,
                paragraph=False,
                link_threshold=0.3,
            )
            
            # 정렬
            sorted_text_list = self.sort_ocr_results(result, processed_img)
            final_text = '\n'.join(sorted_text_list)
            
            return final_text
            
        except Exception as e:
            print(f"이미지 → 텍스트 변환 중 오류: {str(e)}")
            raise Exception(f"이미지 OCR 처리 실패: {str(e)}")
    
    def check_text_extractability(self, pdf_path: str) -> dict:
        """PDF에서 텍스트 추출 가능성 확인"""
        try:
            import fitz  # PyMuPDF
            
            doc = fitz.open(pdf_path)
            total_pages = len(doc)
            extractable_pages = 0
            total_text_length = 0
            
            for page_num in range(total_pages):
                page = doc[page_num]
                text = page.get_text().strip()
                
                if len(text) > 50:  # 최소 50자 이상의 텍스트가 있으면 추출 가능으로 판단
                    extractable_pages += 1
                    total_text_length += len(text)
            
            doc.close()
            
            extractable_ratio = extractable_pages / total_pages if total_pages > 0 else 0
            
            return {
                "total_pages": total_pages,
                "extractable_pages": extractable_pages,
                "extractable_ratio": extractable_ratio,
                "total_text_length": total_text_length,
                "needs_ocr": extractable_ratio < 0.7  # 70% 미만이면 OCR 필요
            }
            
        except Exception as e:
            logger.error(f"텍스트 추출 가능성 확인 실패: {str(e)}")
            return {
                "total_pages": 0,
                "extractable_pages": 0,
                "extractable_ratio": 0,
                "total_text_length": 0,
                "needs_ocr": True
            }

    def extract_text_from_pdf(self, pdf_path: str) -> str:
        """PDF에서 직접 텍스트 추출"""
        try:
            import fitz  # PyMuPDF
            
            doc = fitz.open(pdf_path)
            full_text = ""
            
            for page_num in range(len(doc)):
                page = doc[page_num]
                text = page.get_text()
                full_text += text + "\n"
            
            doc.close()
            logger.info(f"텍스트 직접 추출 완료: {len(full_text)}자")
            return full_text.strip()
            
        except Exception as e:
            logger.error(f"텍스트 직접 추출 실패: {str(e)}")
            return ""
    
    async def ocr_preview(self, pdf_path: str, progress_callback=None) -> dict:
        """
        PDF 파일의 모든 페이지에 대해 OCR을 실행하고 변환율을 계산
        """
        try:
            # 먼저 텍스트 추출 가능성 확인
            extractability = self.check_text_extractability(pdf_path)
            
            # PDF를 이미지로 변환
            dpi = int(os.getenv("PDF_DPI", "300"))
            images = convert_from_path(pdf_path, dpi=dpi)
            
            total_pages = len(images)
            # 전체 작업 수: 파일 불러오기(1) + 각 페이지 OCR(total_pages)
            total_tasks = 1 + total_pages
            current_task = 0
            
            # 1. 파일 불러오기 완료
            current_task += 1
            if progress_callback:
                await progress_callback({
                    "current": current_task,
                    "total": total_tasks,
                    "message": "파일을 불러왔습니다",
                    "page": 0,
                    "total_pages": total_pages
                })
            
            successful_pages = 0
            page_results = []
            all_text = ""
            
            logger.info(f"OCR 프리뷰 시작: {total_pages}페이지")
            
            for page_num, img in enumerate(images, 1):
                try:
                    # 이미지 전처리
                    processed_img = self.preprocess_image(img)
                    
                    # OCR 실행
                    result = self.reader.readtext(np.array(processed_img))
                    
                    # 결과 처리 - 줄바꿈을 고려한 텍스트 연결
                    sorted_text_list = self.sort_ocr_results(result, processed_img)
                    page_text = '\n'.join(sorted_text_list)  # 각 행을 줄바꿈으로 구분
                    detected_items = len([item for item in sorted_text_list if item.strip()])
                    
                    # 페이지 결과 저장
                    page_success = len(page_text) > 10  # 최소 10자 이상 추출되면 성공
                    if page_success:
                        successful_pages += 1
                        # 페이지별로 구분하여 추가
                        if all_text:
                            all_text += "\n\n===== 페이지 구분선 =====\n\n"
                        all_text += page_text
                    
                    page_results.append({
                        "page": page_num,
                        "success": page_success,
                        "text_length": len(page_text),
                        "detected_items": detected_items,
                        "confidence_avg": 0.8,  # 기본값으로 설정
                        "text": page_text  # 페이지별 텍스트 추가
                    })
                    
                    # 진행률 업데이트
                    current_task += 1
                    if progress_callback:
                        await progress_callback({
                            "current": current_task,
                            "total": total_tasks,
                            "message": f"{page_num}페이지 OCR 완료",
                            "page": page_num,
                            "total_pages": total_pages
                        })
                    
                    logger.info(f"페이지 {page_num}/{total_pages} 완료 - 텍스트: {len(page_text)}자, 검출: {detected_items}개")
                    
                except Exception as e:
                    logger.error(f"페이지 {page_num} OCR 실패: {str(e)}")
                    page_results.append({
                        "page": page_num,
                        "success": False,
                        "text_length": 0,
                        "detected_items": 0,
                        "confidence_avg": 0.0,
                        "error": str(e),
                        "text": ""  # 실패한 페이지는 빈 텍스트
                    })
                    
                    # 실패해도 진행률 업데이트
                    current_task += 1
                    if progress_callback:
                        await progress_callback({
                            "current": current_task,
                            "total": total_tasks,
                            "message": f"{page_num}페이지 OCR 실패",
                            "page": page_num,
                            "total_pages": total_pages
                        })
                finally:
                    # 메모리 정리
                    gc.collect()
            
            # 성공률 계산
            success_rate = (successful_pages / total_pages * 100) if total_pages > 0 else 0
            
            # 최종 완료 알림
            if progress_callback:
                await progress_callback({
                    "current": total_tasks,
                    "total": total_tasks,
                    "message": "OCR 완료",
                    "page": total_pages,
                    "total_pages": total_pages,
                    "completed": True
                })
            
            logger.info(f"OCR 프리뷰 완료: {successful_pages}/{total_pages} 페이지 성공 ({success_rate:.1f}%)")
            
            return {
                "total_pages": total_pages,
                "successful_pages": successful_pages,
                "success_rate": round(success_rate, 1),
                "page_results": page_results,
                "preview_text": all_text,  # 전체 텍스트 제공
                "extractability": extractability
            }
            
        except Exception as e:
            logger.error(f"OCR 프리뷰 실패: {str(e)}")
            return {
                "total_pages": 0,
                "successful_pages": 0,
                "success_rate": 0.0,
                "page_results": [],
                "preview_text": "",
                "error": str(e)
            }
    
    async def process_file_with_method(self, file_path: str, processing_method: str, websocket=None, 
                                     progress_callback=None) -> str:
        """파일 처리 방법에 따라 텍스트 추출"""
        try:
            file_service = None
            # FileService 임포트 (순환 임포트 방지)
            from services.file_service import FileService
            file_service = FileService()
            
            if processing_method == "text_extraction":
                # 직접 텍스트 추출
                file_ext = Path(file_path).suffix.lower()
                
                if file_ext == ".pdf":
                    text = file_service.extract_pdf_text(file_path)
                elif file_ext == ".docx":
                    text = file_service.extract_docx_text(file_path)
                else:
                    raise ValueError(f"지원하지 않는 파일 형식: {file_ext}")
                
                if websocket and progress_callback:
                    await progress_callback("completed", 100, "텍스트 추출 완료")
                
                return text
                
            elif processing_method == "ocr":
                # OCR 처리
                return await self.process_file_async(file_path, websocket, progress_callback)
            else:
                raise ValueError(f"알 수 없는 처리 방법: {processing_method}")
                
        except Exception as e:
            logger.error(f"파일 처리 중 오류: {str(e)}")
            if websocket and progress_callback:
                await progress_callback("error", 0, f"처리 중 오류: {str(e)}")
            raise

    async def process_file_async(self, file_path: str, websocket=None, progress_callback=None) -> str:
        """파일을 비동기적으로 OCR 처리하고 진행상황을 웹소켓으로 전송"""
        try:
            file_ext = Path(file_path).suffix.lower()
            
            if progress_callback:
                await progress_callback("processing", 10, "파일 분석 중...")
            
            if file_ext == ".pdf":
                if progress_callback:
                    await progress_callback("processing", 20, "PDF OCR 처리 시작...")
                
                # PDF OCR 처리
                text = await self.pdf_to_text(file_path)
                
                if progress_callback:
                    await progress_callback("completed", 100, "PDF OCR 처리 완료")
                
                return text
                
            elif file_ext in [".png", ".jpg", ".jpeg", ".bmp", ".tiff"]:
                if progress_callback:
                    await progress_callback("processing", 20, "이미지 OCR 처리 시작...")
                
                # 이미지 OCR 처리
                text = await self.image_to_text(file_path)
                
                if progress_callback:
                    await progress_callback("completed", 100, "이미지 OCR 처리 완료")
                
                return text
                
            else:
                error_msg = f"OCR을 지원하지 않는 파일 형식: {file_ext}"
                if progress_callback:
                    await progress_callback("error", 0, error_msg)
                raise ValueError(error_msg)
                
        except Exception as e:
            error_msg = f"OCR 처리 중 오류: {str(e)}"
            logger.error(error_msg)
            if progress_callback:
                await progress_callback("error", 0, error_msg)
            raise Exception(error_msg)

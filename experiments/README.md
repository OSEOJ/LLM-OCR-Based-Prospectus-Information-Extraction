# experiments

파이프라인을 만들기까지의 연구 기록입니다. 완성된 제품 코드는 [`../web/`](../web/)에 있습니다.

노트북 출력 셀은 실제 계약서 내용이 들어 있어 전부 비워 두었습니다. 입력 경로도 각자의
데이터 위치로 바꿔야 실행됩니다.

## ocr/ — OCR 엔진 비교

스캔된 텀시트에서 어느 엔진이 가장 정확한지 비교했습니다.

| 노트북 | 내용 |
|---|---|
| `ocr.ipynb` | Tesseract·EasyOCR·PaddleOCR 3종 비교, 시각화 |
| `easyocr.ipynb` | EasyOCR 단독 심화. 좌표 기반 표 정렬 로직 |
| `paddleocr.ipynb` | PaddleOCR 단독 |

**결론**: EasyOCR을 채택했습니다. 한글·영문 혼용 텀시트에서 가장 안정적이었고, 문자 단위
좌표를 주기 때문에 표 구조를 행 단위로 복원할 수 있었습니다. 이 정렬 로직이
[`web/backend/services/ocr_service.py`](../web/backend/services/ocr_service.py)로 들어갔습니다.

## ocr-postprocess/ — OCR 산출물 후처리

OCR이 반복해서 틀리는 패턴을 규칙으로 교정합니다.

| 파일 | 내용 |
|---|---|
| `ocr_post.ipynb` | LLM 기반 후처리. `prompt/prompt_ver1~6.yaml` 로 프롬프트를 버전별 비교 |
| `spread_percent_postprocess.ipynb` | 가산금리 값의 자릿수 오류 규칙 교정 (`0.559` → `0.55` 류) |

## ocr2json/ — 추출과 정확도 분석

| 파일 | 내용 |
|---|---|
| `text2json.ipynb` | OCR 텍스트 → JSON 변환 실행 |
| `compare_json_frn.ipynb` | FRN 추출 결과를 정답 DB 테이블과 필드별 대조 |
| `compare_json_bond_forward.ipynb` | 채권선도 동일 분석 |

`prompts_frn/`, `prompts_bond_forward/`에 프롬프트 버전들이 있습니다. 채권선도는 9차까지
반복했는데, 이 수동 반복을 자동화한 것이 [`../prompt-optimizer/`](../prompt-optimizer/)입니다.

## 실행

```bash
pip install -r requirements.txt
cp .env.example .env      # OPENAI_API_KEY 입력
```

`ocr/`의 노트북은 시스템 의존성이 추가로 필요합니다 (`poppler`, `tesseract`).

```bash
brew install poppler tesseract tesseract-lang
```

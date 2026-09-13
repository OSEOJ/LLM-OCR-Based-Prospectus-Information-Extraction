# 샘플 데이터

여기 있는 파일은 **전부 합성 데이터**입니다. 실제 거래·발행사·고객 정보가 들어 있지 않습니다.

실제 텀시트(PDF/DOCX)와 그 추출 결과는 저장소에 포함하지 않습니다. 루트 `.gitignore`가
`data/termsheets/`, `data/raw/`, `data/processed/` 와 문서 확장자 전반을 막고 있습니다.

## 파일

| 파일 | 용도 |
|---|---|
| `sample_termsheet_ocr.txt` | OCR 출력 형태의 입력 예시. `experiments/ocr2json` 과 웹 앱의 텍스트 입력 경로 확인용 |
| `sample_bond_forward.json` | 채권선도 추출 결과 스키마 예시 |
| `sample_frn.json` | FRN 추출 결과 스키마 예시 |

## 실제 데이터로 돌릴 때

1. `data/termsheets/` 를 만들고 원본 문서를 넣습니다 (git이 무시합니다).
2. 각 하위 프로젝트의 `.env.example` 을 `.env` 로 복사해 경로와 API 키를 채웁니다.
3. 노트북 상단의 입력 경로 상수를 해당 위치로 바꿉니다.

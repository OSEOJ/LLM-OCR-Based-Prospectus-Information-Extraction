# 프롬프트 자동 최적화 시스템

OCR 텍스트에서 JSON 추출을 위한 프롬프트를 자동으로 최적화하는 시스템입니다.

## 시스템 구성

### 핵심 파일들
- `main_optimization.py`: 메인 실행 파일 (전체 최적화 프로세스 관리)
- `txt2json.py`: 텍스트 → JSON 변환
- `compare.py`: 정확도 분석 및 비교
- `prompts.py`: LLM 기반 프롬프트 개선

### 최적화 프로세스
```
1. 현재 프롬프트로 TXT → JSON 변환
2. 정답 CSV와 비교하여 정확도 계산
3. 오류 분석 및 개선점 식별
4. LLM을 통한 프롬프트 개선
5. 개선된 프롬프트 적용
6. 1-5 반복 (목표 정확도 달성 또는 최대 반복 횟수까지)
```

## 설치 및 설정

### 1. 필요한 패키지 설치
```bash
pip install -r requirements.txt
```

### 2. 환경변수 설정
```bash
export OPENAI_API_KEY='your-openai-api-key-here'
```

### 3. 디렉터리 구조 준비
```
prompt-optimizer/
├── main_optimization.py
├── txt2json.py
├── compare.py
├── prompts.py
├── prompts/
│   └── prompts_FRN.yaml   # 초기 프롬프트 파일
└── prompt_history/        # 자동 생성됨 (백업용)
```

## 사용법

### 1. 기본 실행
```bash
python main_optimization.py
```

### 2. 설정 수정
`main_optimization.py`의 `config` 딕셔너리에서 경로와 파라미터를 수정할 수 있습니다:

```python
config = {
    # 파일 경로
    'prompt_yaml_path': './prompts/prompts_FRN.yaml',
    'csv_path': '../dataset/데이터셋/DB테이블/FRN_Vanilla_단일Payoff.csv',
    'txt_dir': '../dataset/처리/FRN',
    'json_output_dir': '../dataset/처리/FRN/ocr_json_auto',
    
    # 최적화 파라미터
    'max_iterations': 10,        # 최대 반복 횟수
    'min_improvement': 0.01,     # 최소 개선율 (1%)
    'target_accuracy': 0.95,     # 목표 정확도 (95%)
    'sample_size': 5,            # 테스트용 샘플 파일 수
}
```

### 3. 개별 모듈 테스트

#### TXT → JSON 변환 테스트
```python
from txt2json import TXT2JSONConverter

converter = TXT2JSONConverter('./prompts/prompts_FRN.yaml')
converter.process_txt_directory('../dataset/처리/FRN', './output')
```

#### 정확도 분석 테스트
```python
from compare import AccuracyAnalyzer

analyzer = AccuracyAnalyzer('../dataset/데이터셋/DB테이블/FRN_Vanilla_단일Payoff.csv')
results = analyzer.analyze_json_directory('./output')
analyzer.print_analysis_report(results)
```

#### 프롬프트 최적화 테스트
```python
from prompts import PromptOptimizer

optimizer = PromptOptimizer('./prompts/prompts_FRN.yaml')
success, improved = optimizer.optimize_prompts(analysis_result)
```

## 프롬프트 YAML 파일 형식

```yaml
system_prompt: |
  당신은 OCR 텍스트에서 금융상품 정보를 추출하는 전문가입니다.
  다음 필드들을 정확히 추출해주세요:
  - PAYOFF유형, 포지션, 액면통화, 액면금액
  - 발행일, 만기일 (YYYYMMDD 형식)
  - 가산금리, CAP, FLOOR (숫자만)
  
  찾을 수 없는 정보는 "NA"로 표시하세요.

user_prompt: |
  다음 OCR 텍스트에서 정보를 추출하여 JSON 형식으로 출력해주세요:
  
  {text_input}
  
  출력 형식:
  ```json
  {{
    "PAYOFF유형": "값",
    "포지션": "값",
    // ... 기타 필드들
  }}
  ```
```

## 출력 및 로그

### 1. 실시간 출력
- 각 사이클의 진행 상황
- 정확도 변화
- 프롬프트 개선 상황

### 2. 백업 파일
- `prompt_history/`: 프롬프트 변경 히스토리
- 각 개선 시점의 프롬프트가 타임스탬프와 함께 저장됨

### 3. 결과 파일
- `optimization_result.json`: 전체 최적화 결과
- 반복별 정확도, 시간, 설정 등 포함

## 예상 출력 예시

```
================================================================================
프롬프트 자동 최적화 시스템 시작
================================================================================

============================================================
최적화 사이클 1 시작
============================================================

[1/3] TXT → JSON 변환 (프롬프트: prompts_FRN.yaml)
처리 중: KR6347211C19_file1.txt
변환 완료: KR6347211C19_file1.json
변환 완료: 5/5 성공

[2/3] 정확도 분석
분석 시작: 5개 JSON 파일
현재 정확도: 0.7500 (75.00%)

[3/3] 프롬프트 최적화
LLM을 통한 프롬프트 개선안 생성 중...
프롬프트 개선 적용 완료 (백업: 20250625_143022)

사이클 1 완료 (소요시간: 45.2초)

============================================================
최적화 사이클 2 시작
============================================================
...

================================================================================
프롬프트 자동 최적화 완료
================================================================================
총 반복 횟수: 6
최고 정확도: 0.9200 (92.00%) - 반복 5
최종 정확도: 0.9200 (92.00%)
목표 달성: No
총 소요 시간: 324.5초

반복별 정확도 변화:
----------------------------------------
반복  1: 0.7500 (75.00%)
반복  2: 0.8100 (81.00%)
반복  3: 0.8500 (85.00%)
반복  4: 0.8800 (88.00%)
반복  5: 0.9200 (92.00%) ★
반복  6: 0.9150 (91.50%)
```

## 주의사항

1. **API 비용**: OpenAI API 사용량에 따라 비용이 발생합니다
2. **시간 소요**: 각 사이클당 약 1-2분 소요 (파일 수와 복잡도에 따라 변동)
3. **백업**: 모든 프롬프트 변경사항이 자동으로 백업됩니다
4. **샘플 크기**: 빠른 테스트를 위해 소수의 파일만 사용하도록 설정되어 있습니다

## 문제해결

### 1. API 키 오류
```
오류: OPENAI_API_KEY 환경변수가 설정되지 않았습니다.
```
→ OpenAI API 키를 환경변수로 설정하세요

### 2. 파일 경로 오류
→ `config`의 파일 경로들이 실제 파일 위치와 일치하는지 확인하세요

### 3. 프롬프트 개선 실패
→ 네트워크 상태나 API 제한을 확인하고, 잠시 후 재시도하세요

### 4. 정확도가 개선되지 않음
→ 샘플 크기를 늘리거나, 다른 모델(gpt-4)을 사용해보세요

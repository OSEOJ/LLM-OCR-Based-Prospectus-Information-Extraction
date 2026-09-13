# prompts.py
# 정확도 기반 프롬프트 수정 코드

import os
import json
import yaml
import re
from pathlib import Path
from typing import Dict, List, Any, Tuple
import time
import shutil
from datetime import datetime

class PromptOptimizer:
    """프롬프트 자동 최적화 클래스"""
    
    def __init__(self, prompt_yaml_path: str, backup_dir: str = "./prompt_history"):
        """
        Args:
            prompt_yaml_path: 프롬프트 YAML 파일 경로
            backup_dir: 프롬프트 백업 디렉터리
        """
        self.prompt_yaml_path = Path(prompt_yaml_path)
        self.backup_dir = Path(backup_dir)
        self.backup_dir.mkdir(exist_ok=True)
        
        # OpenAI 클라이언트 초기화
        from openai import OpenAI
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            raise ValueError("OPENAI_API_KEY 환경변수가 설정되지 않았습니다.")
        self.client = OpenAI(api_key=api_key)
        
        self.load_prompts()
        self.optimization_history = []
    
    def load_prompts(self):
        """YAML 파일에서 프롬프트 로드"""
        try:
            with open(self.prompt_yaml_path, 'r', encoding='utf-8') as f:
                self.prompts = yaml.safe_load(f)
                
            # 필수 프롬프트 확인
            if 'system_prompt' not in self.prompts or 'user_prompt' not in self.prompts:
                raise ValueError("YAML 파일에 system_prompt와 user_prompt가 필요합니다.")
                
            print(f"프롬프트 로드 완료: {self.prompt_yaml_path}")
            
        except Exception as e:
            raise ValueError(f"프롬프트 로드 실패: {e}")
    
    def save_prompts(self, backup_suffix: str = None):
        """프롬프트를 YAML 파일에 저장 (백업 포함)"""
        if backup_suffix:
            backup_path = self.backup_dir / f"{self.prompt_yaml_path.stem}_{backup_suffix}.yaml"
            shutil.copy(self.prompt_yaml_path, backup_path)
            print(f"프롬프트 백업 저장: {backup_path}")
        
        with open(self.prompt_yaml_path, 'w', encoding='utf-8') as f:
            yaml.dump(self.prompts, f, default_flow_style=False, indent=2, allow_unicode=True)
        
        print(f"프롬프트 저장 완료: {self.prompt_yaml_path}")
    
    def generate_improvement_prompt(self, analysis_result: Dict[str, Any], 
                                  sample_errors: List[Dict] = None) -> str:
        """
        정확도 분석 결과를 바탕으로 프롬프트 개선 요청 생성
        
        Args:
            analysis_result: 정확도 분석 결과
            sample_errors: 샘플 오류 사례들
            
        Returns:
            프롬프트 개선 요청 문자열
        """
        
        # 현재 프롬프트 정보
        current_system = self.prompts.get('system_prompt', '')
        current_user = self.prompts.get('user_prompt', '')
        
        # 분석 결과 요약
        overall_acc = analysis_result.get('overall_accuracy', 0)
        field_accuracies = analysis_result.get('field_accuracies', {})
        field_errors = analysis_result.get('field_errors', {})
        
        # 가장 문제가 많은 필드들 식별
        problematic_fields = sorted([(field, 1-acc) for field, acc in field_accuracies.items()], 
                                  key=lambda x: x[1], reverse=True)[:5]
        
        error_counts = sorted([(field, len(errors)) for field, errors in field_errors.items()], 
                            key=lambda x: x[1], reverse=True)[:5]
        
        # 개선 요청 프롬프트 구성
        improvement_prompt = f"""
당신은 프롬프트 엔지니어링 전문가입니다. 
OCR 텍스트에서 금융상품 정보를 JSON으로 추출하는 프롬프트를 개선해야 합니다.

## 현재 프롬프트
### System Prompt:
{current_system}

### User Prompt:
{current_user}

## 성능 분석 결과
- 전체 정확도: {overall_acc:.2%}
- 처리된 파일: {analysis_result.get('processed_files', 0)}개

## 문제가 있는 필드들 (정확도 낮은 순)
"""
        
        for field, error_rate in problematic_fields:
            accuracy = field_accuracies.get(field, 0)
            improvement_prompt += f"- {field}: {accuracy:.2%} 정확도\n"
        
        improvement_prompt += "\n## 오류가 많은 필드들\n"
        for field, count in error_counts:
            accuracy = field_accuracies.get(field, 0)
            improvement_prompt += f"- {field}: {count}개 오류 (정확도: {accuracy:.2%})\n"
        
        # 샘플 오류 추가
        if sample_errors:
            improvement_prompt += "\n## 샘플 오류 사례들\n"
            for i, error in enumerate(sample_errors[:3], 1):
                improvement_prompt += f"### 오류 사례 {i}\n"
                improvement_prompt += f"- 필드: {error.get('field', 'Unknown')}\n"
                improvement_prompt += f"- 정답: {error.get('csv_value', 'N/A')}\n"
                improvement_prompt += f"- LLM 출력: {error.get('json_value', 'N/A')}\n\n"
        
        improvement_prompt += """
## 개선 요청
위의 분석 결과를 바탕으로 다음 요구사항을 만족하는 개선된 프롬프트를 제안해주세요:

1. 정확도가 낮은 필드들의 추출 정확도를 향상시켜야 합니다
2. JSON 형식을 정확히 지켜야 합니다
3. 빈 값이나 찾을 수 없는 정보는 "NA"로 표시해야 합니다
4. 날짜는 YYYYMMDD 형식으로 추출해야 합니다
5. 금액은 숫자만 추출해야 합니다

## 응답 형식
응답은 반드시 다음 JSON 형식으로 제공해주세요:

```json
{
    "system_prompt": "개선된 시스템 프롬프트",
    "user_prompt": "개선된 유저 프롬프트 ({{text_input}} 플레이스홀더 포함)",
    "improvement_rationale": "개선 사유 및 전략 설명"
}
```
"""
        
        return improvement_prompt
    
    def call_optimization_llm(self, improvement_prompt: str, model: str = "gpt-4o") -> Dict[str, str]:
        """
        LLM을 호출하여 프롬프트 개선안 생성
        
        Args:
            improvement_prompt: 개선 요청 프롬프트
            model: 사용할 모델명
            
        Returns:
            개선된 프롬프트 딕셔너리
        """
        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system", 
                        "content": "당신은 프롬프트 엔지니어링 전문가입니다. 주어진 분석 결과를 바탕으로 프롬프트를 개선해주세요."
                    },
                    {
                        "role": "user", 
                        "content": improvement_prompt
                    }
                ],
                temperature=0.3,
                max_tokens=4000
            )
            
            content = response.choices[0].message.content.strip()
            
            # JSON 추출 - 더 안전한 방법
            improved_prompts = None
            
            # 먼저 ```json 태그로 감싸진 경우 시도
            if '```json' in content:
                json_start = content.find('```json') + 7
                json_end = content.find('```', json_start)
                if json_end != -1:
                    json_str = content[json_start:json_end].strip()
                else:
                    json_str = content[json_start:].strip()
                
                try:
                    improved_prompts = json.loads(json_str)
                except json.JSONDecodeError:
                    print("JSON 태그 내 파싱 실패, 다른 방법 시도")
            
            # JSON 태그 방법이 실패하면 중괄호 찾기
            if improved_prompts is None:
                import re
                json_match = re.search(r'\{.*\}', content, re.DOTALL)
                if json_match:
                    json_str = json_match.group(0)
                    try:
                        improved_prompts = json.loads(json_str)
                    except json.JSONDecodeError:
                        print("정규식 방법도 실패")
            
            # 두 방법 모두 실패하면 전체 내용으로 시도
            if improved_prompts is None:
                try:
                    improved_prompts = json.loads(content)
                except json.JSONDecodeError as e:
                    print(f"JSON 파싱 완전 실패: {e}")
                    print(f"응답 내용 (처음 500자): {content[:500]}")
                    return None
            
            if improved_prompts is None:
                print("모든 JSON 추출 방법 실패")
                return None
            
            # 필수 키 확인
            required_keys = ['system_prompt', 'user_prompt']
            for key in required_keys:
                if key not in improved_prompts:
                    raise ValueError(f"필수 키 누락: {key}")
            
            return improved_prompts
            
        except Exception as e:
            print(f"프롬프트 개선 LLM 호출 오류: {e}")
            return None
    
    def apply_improvements(self, improved_prompts: Dict[str, str]) -> bool:
        """
        개선된 프롬프트를 적용
        
        Args:
            improved_prompts: 개선된 프롬프트 딕셔너리
            
        Returns:
            적용 성공 여부
        """
        try:
            # 현재 시간으로 백업
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            self.save_prompts(backup_suffix=timestamp)
            
            # 새 프롬프트 적용
            self.prompts['system_prompt'] = improved_prompts['system_prompt']
            self.prompts['user_prompt'] = improved_prompts['user_prompt']
            
            # 개선 히스토리 저장
            self.optimization_history.append({
                'timestamp': timestamp,
                'rationale': improved_prompts.get('improvement_rationale', ''),
                'system_prompt': improved_prompts['system_prompt'],
                'user_prompt': improved_prompts['user_prompt']
            })
            
            # YAML 파일 저장
            self.save_prompts()
            
            print(f"프롬프트 개선 적용 완료 (백업: {timestamp})")
            return True
            
        except Exception as e:
            print(f"프롬프트 적용 오류: {e}")
            return False
    
    def optimize_prompts(self, analysis_result: Dict[str, Any], 
                        sample_errors: List[Dict] = None) -> Tuple[bool, Dict]:
        """
        전체 프롬프트 최적화 프로세스 실행
        
        Args:
            analysis_result: 정확도 분석 결과
            sample_errors: 샘플 오류 사례들
            
        Returns:
            (성공 여부, 개선된 프롬프트)
        """
        try:
            print("프롬프트 최적화 시작...")
            
            # 1. 개선 요청 생성
            improvement_prompt = self.generate_improvement_prompt(analysis_result, sample_errors)
            
            # 2. LLM 호출하여 개선안 생성
            print("LLM을 통한 프롬프트 개선안 생성 중...")
            improved_prompts = self.call_optimization_llm(improvement_prompt)
            
            if not improved_prompts:
                print("프롬프트 개선안 생성 실패")
                return False, {}
            
            # 3. 개선안 적용
            success = self.apply_improvements(improved_prompts)
            
            if success:
                print("프롬프트 최적화 완료")
                print(f"개선 사유: {improved_prompts.get('improvement_rationale', 'N/A')}")
                return True, improved_prompts
            else:
                return False, {}
                
        except Exception as e:
            print(f"프롬프트 최적화 오류: {e}")
            return False, {}
    
    def get_sample_errors(self, analysis_result: Dict[str, Any], max_samples: int = 5) -> List[Dict]:
        """
        샘플 오류 사례 추출
        
        Args:
            analysis_result: 정확도 분석 결과
            max_samples: 최대 샘플 수
            
        Returns:
            샘플 오류 리스트
        """
        field_errors = analysis_result.get('field_errors', {})
        sample_errors = []
        
        # 각 필드에서 샘플 오류 추출
        for field, errors in field_errors.items():
            if len(sample_errors) >= max_samples:
                break
                
            if errors:
                # 첫 번째 오류 사례 추가
                error_case = errors[0]
                sample_errors.append({
                    'field': field,
                    'csv_value': error_case.get('CSV값', ''),
                    'json_value': error_case.get('JSON값', ''),
                    'filename': error_case.get('파일명', '')
                })
        
        return sample_errors
    
    def print_optimization_history(self):
        """최적화 히스토리 출력"""
        if not self.optimization_history:
            print("최적화 히스토리가 없습니다.")
            return
        
        print("\n프롬프트 최적화 히스토리:")
        print("=" * 60)
        
        for i, history in enumerate(self.optimization_history, 1):
            print(f"\n{i}. {history['timestamp']}")
            print(f"   개선 사유: {history['rationale']}")
            print(f"   시스템 프롬프트 길이: {len(history['system_prompt'])} 문자")
            print(f"   유저 프롬프트 길이: {len(history['user_prompt'])} 문자")


def main():
    """메인 실행 함수 - 테스트용"""
    
    # 설정
    PROMPT_YAML = "./yaml/prompts_FRN2.yaml"
    
    # 더미 분석 결과 (실제로는 compare.py에서 가져옴)
    dummy_analysis = {
        'overall_accuracy': 0.75,
        'processed_files': 10,
        'field_accuracies': {
            '가산금리': 0.5,
            '발행일': 0.9,
            '만기일': 0.85,
            'CAP': 0.6
        },
        'field_errors': {
            '가산금리': [
                {'파일명': 'test1.json', 'CSV값': '1.5', 'JSON값': '1.50%'},
                {'파일명': 'test2.json', 'CSV값': '2.0', 'JSON값': 'NA'}
            ]
        }
    }
    
    try:
        # 최적화기 초기화
        optimizer = PromptOptimizer(PROMPT_YAML)
        
        # 프롬프트 최적화 실행
        success, improved = optimizer.optimize_prompts(dummy_analysis)
        
        if success:
            print("\n=== 최적화 결과 ===")
            print(f"시스템 프롬프트: {improved['system_prompt'][:100]}...")
            print(f"유저 프롬프트: {improved['user_prompt'][:100]}...")
        else:
            print("프롬프트 최적화 실패")
            
    except Exception as e:
        print(f"실행 오류: {e}")


if __name__ == "__main__":
    main()
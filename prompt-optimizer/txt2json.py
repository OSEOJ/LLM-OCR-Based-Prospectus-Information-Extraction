# txt2json.py
# 텍스트를 json으로 변환하는 코드

import os
import json
import yaml
import openai
from pathlib import Path
from typing import Dict, Any, Optional
import re
import time

class TXT2JSONConverter:
    """텍스트 파일을 JSON으로 변환하는 클래스"""
    
    def __init__(self, prompt_yaml_path: str, model_name: str = "gpt-4o-mini"):
        """
        Args:
            prompt_yaml_path: 프롬프트가 저장된 YAML 파일 경로
            model_name: 사용할 OpenAI 모델명
        """
        self.prompt_yaml_path = Path(prompt_yaml_path)
        self.model_name = model_name
        
        # OpenAI 클라이언트 초기화
        from openai import OpenAI
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            raise ValueError("OPENAI_API_KEY 환경변수가 설정되지 않았습니다.")
        self.client = OpenAI(api_key=api_key)
        
        self.load_prompts()
    
    def load_prompts(self):
        """YAML 파일에서 프롬프트 로드"""
        try:
            with open(self.prompt_yaml_path, 'r', encoding='utf-8') as f:
                self.prompts = yaml.safe_load(f)
                
            # 필수 프롬프트 확인
            if 'system_prompt' not in self.prompts or 'user_prompt' not in self.prompts:
                raise ValueError("YAML 파일에 system_prompt와 user_prompt가 필요합니다.")
                
        except Exception as e:
            raise ValueError(f"프롬프트 로드 실패: {e}")
    
    def convert_text_to_json(self, text_content: str, max_retries: int = 3) -> Dict[str, Any]:
        """
        텍스트를 JSON으로 변환
        
        Args:
            text_content: 변환할 텍스트 내용
            max_retries: 최대 재시도 횟수
            
        Returns:
            변환된 JSON 딕셔너리
        """
        for attempt in range(max_retries):
            try:
                # 프롬프트 구성
                system_prompt = self.prompts['system_prompt']
                user_prompt = self.prompts['user_prompt'].format(text_input=text_content)
                
                # OpenAI API 호출
                response = self.client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.1,
                    max_tokens=4000
                )
                
                # 응답에서 JSON 추출
                content = response.choices[0].message.content.strip()
                json_data = self.extract_json_from_response(content)
                
                # 유효성 검증
                if self.validate_json_output(json_data):
                    return json_data
                else:
                    print(f"JSON 유효성 검증 실패 (시도 {attempt + 1}/{max_retries})")
                    
            except Exception as e:
                print(f"변환 시도 {attempt + 1}/{max_retries} 실패: {e}")
                if attempt < max_retries - 1:
                    time.sleep(1)  # 재시도 전 대기
                    
        # 모든 시도 실패 시 빈 딕셔너리 반환
        print("모든 변환 시도 실패")
        return {}
    
    def extract_json_from_response(self, response_content: str) -> Dict[str, Any]:
        """응답에서 JSON 부분만 추출"""
        try:
            # ```json 태그로 감싸진 경우
            if '```json' in response_content:
                json_start = response_content.find('```json') + 7
                json_end = response_content.find('```', json_start)
                if json_end != -1:
                    json_str = response_content[json_start:json_end].strip()
                else:
                    json_str = response_content[json_start:].strip()
            else:
                # 중괄호로 시작하는 JSON 찾기
                json_match = re.search(r'\{.*\}', response_content, re.DOTALL)
                if json_match:
                    json_str = json_match.group(0)
                else:
                    json_str = response_content
            
            return json.loads(json_str)
            
        except json.JSONDecodeError as e:
            print(f"JSON 파싱 오류: {e}")
            print(f"원본 응답: {response_content[:500]}...")
            return {}
    
    def validate_json_output(self, json_data: Dict[str, Any]) -> bool:
        """
        JSON 출력 유효성 검증
        
        Args:
            json_data: 검증할 JSON 데이터
            
        Returns:
            유효성 검증 결과
        """
        if not json_data or json_data is None:
            return False
        
        # JSON 데이터가 딕셔너리인지 확인
        if not isinstance(json_data, dict):
            return False
        
        # 필수 필드가 있는지 확인 (필요에 따라 수정)
        required_fields = [
            "PAYOFF유형", "포지션", "액면통화", "액면금액", "발행일", "만기일"
        ]
        
        for field in required_fields:
            if field not in json_data:
                print(f"필수 필드 누락: {field}")
                return False
        
        return True
    
    def process_txt_file(self, txt_file_path: str, output_dir: str) -> bool:
        """
        단일 TXT 파일을 처리하여 JSON으로 변환
        
        Args:
            txt_file_path: 입력 TXT 파일 경로
            output_dir: 출력 디렉터리 경로
            
        Returns:
            처리 성공 여부
        """
        try:
            txt_path = Path(txt_file_path)
            output_path = Path(output_dir)
            output_path.mkdir(parents=True, exist_ok=True)
            
            # TXT 파일 읽기
            with open(txt_path, 'r', encoding='utf-8') as f:
                text_content = f.read()
            
            print(f"처리 중: {txt_path.name}")
            
            # JSON 변환
            json_data = self.convert_text_to_json(text_content)
            
            if json_data:
                # JSON 파일로 저장
                json_filename = txt_path.stem + '.json'
                json_file_path = output_path / json_filename
                
                with open(json_file_path, 'w', encoding='utf-8') as f:
                    json.dump(json_data, f, ensure_ascii=False, indent=2)
                
                print(f"변환 완료: {json_filename}")
                return True
            else:
                print(f"변환 실패: {txt_path.name}")
                return False
                
        except Exception as e:
            print(f"파일 처리 오류 ({txt_file_path}): {e}")
            return False
    
    def process_txt_directory(self, txt_dir: str, output_dir: str) -> Dict[str, bool]:
        """
        디렉터리 내 모든 TXT 파일을 처리
        
        Args:
            txt_dir: TXT 파일들이 있는 디렉터리
            output_dir: 출력 디렉터리
            
        Returns:
            파일별 처리 결과 딕셔너리
        """
        txt_path = Path(txt_dir)
        results = {}
        
        # TXT 파일 목록 가져오기
        txt_files = list(txt_path.glob("*.txt"))
        
        if not txt_files:
            print(f"TXT 파일을 찾을 수 없습니다: {txt_dir}")
            return results
        
        print(f"총 {len(txt_files)}개 파일 처리 시작")
        
        for txt_file in txt_files:
            success = self.process_txt_file(str(txt_file), output_dir)
            results[txt_file.name] = success
        
        # 결과 요약
        success_count = sum(results.values())
        print(f"\n처리 완료: {success_count}/{len(txt_files)} 성공")
        
        return results


def main():
    """메인 실행 함수 - 테스트용"""
    
    # 설정
    PROMPT_YAML = "./yaml/prompts_FRN2.yaml"  # 프롬프트 YAML 파일 경로
    TXT_DIR = "../dataset/처리/FRN"  # TXT 파일 디렉터리
    OUTPUT_DIR = "../dataset/처리/FRN/ocr_json"  # JSON 출력 디렉터리
    
    try:
        # 변환기 초기화
        converter = TXT2JSONConverter(PROMPT_YAML)
        
        # 디렉터리 처리
        results = converter.process_txt_directory(TXT_DIR, OUTPUT_DIR)
        
        print("\n=== 처리 결과 ===")
        for filename, success in results.items():
            status = "성공" if success else "실패"
            print(f"{filename}: {status}")
            
    except Exception as e:
        print(f"실행 오류: {e}")


if __name__ == "__main__":
    main()
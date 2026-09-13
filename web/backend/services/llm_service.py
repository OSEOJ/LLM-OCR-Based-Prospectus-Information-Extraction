import os
import yaml
import json
import time
import tiktoken
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path

from openai import OpenAI
from dotenv import load_dotenv

# .env 파일 경로 설정
env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

class PromptManager:
    def __init__(self, yaml_path: str):
        if not os.path.isfile(yaml_path):
            raise FileNotFoundError(f"프롬프트 YAML을 찾을 수 없습니다: {yaml_path}")
        
        with open(yaml_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        self.prompts = data.get('prompts', {})
        # 프런트엔드는 'frn'/'irs', YAML 키는 'FRN'/'IRS' 처럼 표기가 갈린다.
        # 조회를 한 곳에서 대소문자 무시로 통일해 호출자마다 매핑하지 않게 한다.
        self._index = {k.lower(): v for k, v in self.prompts.items()}
    
    def _entries(self, product: str):
        return self._index.get(str(product).lower())
    
    def list_versions(self, product: str) -> List[str]:
        """해당 상품에 사용 가능한 버전 목록 반환"""
        return [e['version'] for e in (self._entries(product) or [])]
    
    def get_prompt(self, product: str, version: str = None) -> str:
        """상품(product)과 버전(version)에 맞는 template 반환 (버전 누락 시 최신)"""
        entries = self._entries(product)
        if not entries:
            raise KeyError(f"상품 정의 없음: {product}")
        
        if version:
            for e in entries:
                if e['version'] == version:
                    return e['template']
            raise KeyError(f"{product}에 버전 {version} 없음")
        
        # 최신 버전 (버전 문자열 내림차순 가정)
        latest = sorted(entries, key=lambda e: e['version'], reverse=True)[0]
        return latest['template']
    
    def get_supported_products(self) -> Dict[str, List[str]]:
        """지원되는 모든 상품과 버전 목록 반환"""
        result = {}
        for product, entries in self.prompts.items():
            result[product] = [e['version'] for e in entries]
        return result

class LLMService:
    def __init__(self):
        self.client = None
        self.prompt_manager = None
        self.model_name = os.getenv("MODEL_NAME", "gpt-4o-mini")
        self.temperature = float(os.getenv("MODEL_TEMPERATURE", "0.0"))
        self.seed = int(os.getenv("MODEL_SEED", "42"))
        
        self._initialize_client()
        self._initialize_prompt_manager()
    
    def _initialize_client(self):
        """OpenAI 클라이언트 초기화"""
        try:
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key or api_key == "your_openai_api_key_here":
                raise Exception("OPENAI_API_KEY가 설정되지 않았습니다. .env 파일을 확인해주세요.")
            
            self.client = OpenAI(api_key=api_key)
            print("OpenAI 클라이언트 초기화 완료")
        except Exception as e:
            print(f"OpenAI 클라이언트 초기화 실패: {str(e)}")
            self.client = None
    
    def _initialize_prompt_manager(self):
        """프롬프트 매니저 초기화"""
        try:
            # 프로젝트 루트의 prompts 디렉터리 찾기
            prompt_dir = Path(__file__).parent.parent.parent / "prompts"
            yaml_path = prompt_dir / "prompts.yaml"
            
            if not yaml_path.exists():
                raise FileNotFoundError(f"프롬프트 파일을 찾을 수 없습니다: {yaml_path}")
            
            self.prompt_manager = PromptManager(str(yaml_path))
            print("프롬프트 매니저 초기화 완료")
        except Exception as e:
            print(f"프롬프트 매니저 초기화 실패: {str(e)}")
            self.prompt_manager = None
    
    def is_ready(self) -> bool:
        """LLM 서비스 준비 상태 확인"""
        return self.client is not None and self.prompt_manager is not None
    
    def split_text(self, text: str, max_chars: int = 12000) -> List[str]:
        """
        텍스트를 max_chars 내외로 청크를 나눕니다.
        문단 단위(\n)로 쪼갠 뒤 합치는 방식으로 크게 깨지지 않게 분할.
        """
        paras = text.split('\n')
        chunks, cur = [], ""
        
        for p in paras:
            if len(cur) + len(p) + 1 <= max_chars:
                cur += p + "\n"
            else:
                if cur:
                    chunks.append(cur)
                cur = p + "\n"
        
        if cur:
            chunks.append(cur)
        
        return chunks
    
    def calculate_token_count(self, text: str) -> int:
        """텍스트의 토큰 수 계산"""
        try:
            enc = tiktoken.encoding_for_model(self.model_name)
        except KeyError:
            enc = tiktoken.get_encoding("cl100k_base")
        
        return len(enc.encode(text))
    
    async def call_llm(self, prompt: str, max_retries: int = 3) -> str:
        """LLM API 호출"""
        if not self.is_ready():
            raise Exception("LLM 서비스가 초기화되지 않았습니다.")
        
        for attempt in range(1, max_retries + 1):
            try:
                response = self.client.chat.completions.create(
                    model=self.model_name,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=self.temperature,
                    top_p=0.05,
                    frequency_penalty=0.0,
                    presence_penalty=0.0,
                    seed=self.seed
                )
                
                return response.choices[0].message.content
                
            except Exception as e:
                print(f"LLM 호출 시도 {attempt}/{max_retries} 실패: {str(e)}")
                if attempt == max_retries:
                    raise Exception(f"LLM 호출 실패: {str(e)}")
                
                # 재시도 전 대기
                time.sleep(2 ** (attempt - 1))
    
    def parse_llm_response(self, text: str) -> Dict[str, Any]:
        """LLM 응답에서 JSON 추출 및 파싱"""
        try:
            # 먼저 전체 텍스트를 JSON으로 파싱 시도
            return json.loads(text)
        except json.JSONDecodeError:
            try:
                # JSON 블록을 찾아서 파싱 시도
                start = text.find('{')
                end = text.rfind('}') + 1
                
                if start != -1 and end > start:
                    json_text = text[start:end]
                    return json.loads(json_text)
                else:
                    raise ValueError("응답에서 JSON을 찾을 수 없습니다.")
                    
            except json.JSONDecodeError as e:
                raise ValueError(f"JSON 파싱 실패: {str(e)}\n응답 내용: {text}")
    
    async def text_to_json(self, text: str, product_type: str = "bond_forward", 
                          version: Optional[str] = None, with_mapping: bool = False) -> Dict[str, Any]:
        """텍스트를 LLM을 통해 JSON으로 변환 (매핑 정보 포함 가능)"""
        if not self.is_ready():
            raise Exception("LLM 서비스가 초기화되지 않았습니다.")
        
        try:
            # 프롬프트 템플릿 가져오기
            template = self.prompt_manager.get_prompt(product_type, version)
            
            # 텍스트 청크 분할 및 토큰 수 계산
            chunks = self.split_text(text)
            
            for i, chunk in enumerate(chunks, 1):
                prompt_chunk = template.replace("{{text}}", chunk)
                token_count = self.calculate_token_count(prompt_chunk)
                print(f"[Chunk {i}] 토큰 수: {token_count}")
            
            # 전체 텍스트로 LLM 호출
            prompt_full = template.replace("{{text}}", text)
            token_count_full = self.calculate_token_count(prompt_full)
            print(f"전체 프롬프트 토큰 수: {token_count_full}")
            
            # LLM 호출
            print(f"LLM 호출 시작 - 모델: {self.model_name}, 상품: {product_type}, 매핑: {with_mapping}")
            response_text = await self.call_llm(prompt_full)
            
            # JSON 파싱
            parsed_result = self.parse_llm_response(response_text)
            
            # 매핑 정보가 포함된 응답인지 확인
            if with_mapping and "field_mappings" in parsed_result:
                # 매핑 정보가 포함된 경우 그대로 반환
                print("매핑 정보가 포함된 LLM 처리 완료")
                return parsed_result
            elif with_mapping:
                # 매핑이 요청되었지만 응답에 없는 경우 기본 구조로 래핑
                print("매핑 정보 없이 LLM 처리 완료, 기본 구조로 래핑")
                return {
                    "json_result": parsed_result,
                    "field_mappings": []
                }
            else:
                # 기존 방식 (매핑 없이 JSON만 반환)
                print("LLM 처리 완료")
                return parsed_result
            
        except Exception as e:
            print(f"텍스트 → JSON 변환 중 오류: {str(e)}")
            raise Exception(f"LLM 처리 실패: {str(e)}")
    
    def get_supported_products(self) -> Dict[str, List[str]]:
        """지원되는 상품 타입과 버전 목록 반환"""
        if not self.prompt_manager:
            return {}
        
        return self.prompt_manager.get_supported_products()
    
    def validate_json_structure(self, json_data: Dict[str, Any], 
                               product_type: str) -> bool:
        """JSON 구조 유효성 검사"""
        try:
            if product_type == "bond_forward":
                required_fields = [
                    "포지션", "액면통화", "액맨금액", "기초자산", "효력발생일",
                    "만기일", "BDC", "영업일적용여부", "영업일적용도시", "정산방식",
                    "채권유형", "표면금리", "만기정산금액", "선도가격", "결제통화"
                ]
            elif product_type == "FRN":
                required_fields = [
                    "product_type", "notional_amount", "currency", 
                    "issue_date", "maturity_date", "floating_rate_basis", "spread"
                ]
            else:
                # 기본적인 JSON 구조만 확인
                return isinstance(json_data, dict) and len(json_data) > 0
            
            # 필수 필드 존재 확인
            for field in required_fields:
                if field not in json_data:
                    print(f"필수 필드 누락: {field}")
                    return False
            
            return True
            
        except Exception as e:
            print(f"JSON 유효성 검사 중 오류: {str(e)}")
            return False

# compare.py
# 정답 csv와 llm 출력 json과 전체 및 각 컬럼 정확도 산출 코드

import os
import json
import pandas as pd
from pathlib import Path
from datetime import datetime
from collections import defaultdict
import re
from typing import Dict, List, Tuple, Any
import matplotlib.pyplot as plt
import seaborn as sns
import platform

class AccuracyAnalyzer:
    """정확도 분석 및 비교 클래스"""
    
    def __init__(self, csv_path: str):
        """
        Args:
            csv_path: 정답이 포함된 CSV 파일 경로
        """
        self.csv_path = Path(csv_path)
        self.load_reference_data()
        self.setup_fields()
        self.setup_visualization()
    
    def load_reference_data(self):
        """기준 CSV 데이터 로드"""
        try:
            self.df = pd.read_csv(self.csv_path, encoding="cp949")
            self.df["상품명"] = self.df["상품명"].astype(str)
            
            # 접두사 패턴 정의 및 추가 (예: KR6347211C19)
            self.prefix_pat = re.compile(r'(KR\d{7}[A-Z]\d{2})')
            self.df["Prefix"] = self.df["상품명"].apply(
                lambda s: self.prefix_pat.search(s).group(1) if self.prefix_pat.search(s) else ""
            )
            
            print(f"기준 데이터 로드 완료: {len(self.df)}개 행")
            
        except Exception as e:
            raise ValueError(f"CSV 파일 로드 실패: {e}")
    
    def setup_fields(self):
        """비교 대상 필드 설정"""
        self.fields_to_compare = [
            "PAYOFF유형", "포지션", "액면통화", "액면금액", "임의상환옵션유무", "자동조기상환유무",
            "AMORT유무", "스위치옵션유무", "PERIOD구분", "발행일", "만기일",
            "BDC", "이자계산주기", "이자지급주기", "이자지급시점", "영업일적용여부", "영업일적용도시", 
            "FIXING기준적용도시", "DCC", "변동금리결정시점", "결정LAG", "승수", "가산금리", "CAP", "FLOOR"
        ]
    
    def setup_visualization(self):
        """시각화 설정"""
        if platform.system() == 'Darwin':
            plt.rcParams['font.family'] = 'AppleGothic'
        elif platform.system() == 'Windows':
            plt.rcParams['font.family'] = 'Malgun Gothic'
        else:
            plt.rcParams['font.family'] = 'NanumGothic'
        plt.rcParams['axes.unicode_minus'] = False
    
    def normalize_value(self, val):
        """값 정규화 (날짜, 숫자, 문자열 통일)"""
        if pd.isna(val) or val == "":
            return ""
        
        val = str(val).strip()
        
        # 날짜 형식 정규화
        date_formats = ["%Y%m%d", "%Y-%m-%d", "%Y.%m.%d"]
        for fmt in date_formats:
            try:
                return datetime.strptime(val, fmt).date()
            except ValueError:
                continue
        
        # 숫자 형식 정규화
        try:
            return float(val)
        except (ValueError, TypeError):
            return val.lower()
    
    def extract_prefix(self, filename: str) -> str:
        """파일명에서 prefix 추출"""
        match = self.prefix_pat.search(filename)
        return match.group(1) if match else ""
    
    def calculate_single_accuracy(self, csv_row: pd.Series, json_data: Dict[str, Any]) -> Tuple[float, Dict, Dict]:
        """
        단일 파일에 대한 정확도 계산
        
        Args:
            csv_row: CSV의 해당 행
            json_data: JSON 데이터
            
        Returns:
            (정확도, 오류 정보, 필드별 정확도)
        """
        correct = 0
        errors = {}
        field_hits = {}
        
        for field in self.fields_to_compare:
            csv_val = csv_row.get(field, "")
            json_val = json_data.get(field, "")
            
            # 특별 케이스: CSV가 비어있고 JSON이 "NA"인 경우 정답 처리
            if (csv_val == "" or pd.isna(csv_val)) and str(json_val).strip().upper() == "NA":
                correct += 1
                field_hits[field] = 1
                continue
            
            # 값 정규화 후 비교
            norm_csv = self.normalize_value(csv_val)
            norm_json = self.normalize_value(json_val)
            
            if norm_csv == norm_json:
                correct += 1
                field_hits[field] = 1
            else:
                errors[field] = {"CSV": csv_val, "JSON": json_val}
                field_hits[field] = 0
        
        accuracy = correct / len(self.fields_to_compare)
        return accuracy, errors, field_hits
    
    def analyze_json_directory(self, json_dir: str) -> Dict[str, Any]:
        """
        JSON 디렉터리 내 모든 파일 분석
        
        Args:
            json_dir: JSON 파일들이 있는 디렉터리
            
        Returns:
            분석 결과 딕셔너리
        """
        json_path = Path(json_dir)
        
        if not json_path.exists():
            raise ValueError(f"JSON 디렉터리가 존재하지 않습니다: {json_dir}")
        
        results = []
        field_accuracies = defaultdict(list)
        field_errors = defaultdict(list)
        unmatched_files = []
        
        # JSON 파일 목록
        json_files = list(json_path.glob("*.json"))
        
        if not json_files:
            print(f"JSON 파일을 찾을 수 없습니다: {json_dir}")
            return self._create_empty_result()
        
        print(f"분석 시작: {len(json_files)}개 JSON 파일")
        
        for json_file in json_files:
            # 파일명에서 prefix 추출
            json_prefix = self.extract_prefix(json_file.name)
            
            if not json_prefix:
                unmatched_files.append(json_file.name)
                continue
            
            # CSV에서 매칭되는 행 찾기
            matched_rows = self.df[self.df["Prefix"] == json_prefix]
            if matched_rows.empty:
                unmatched_files.append(json_file.name)
                continue
            
            try:
                # JSON 파일 로드
                with open(json_file, 'r', encoding='utf-8') as f:
                    json_data = json.load(f)
                
                matched_row = matched_rows.iloc[0]
                acc, errors, field_hits = self.calculate_single_accuracy(matched_row, json_data)
                
                results.append({
                    'filename': json_file.name,
                    'prefix': json_prefix,
                    'accuracy': acc,
                    'field_hits': field_hits
                })
                
                # 필드별 정확도 저장
                for field, hit in field_hits.items():
                    field_accuracies[field].append(hit)
                    
                    # 오류 케이스 저장
                    if hit == 0:
                        field_errors[field].append({
                            "파일명": json_file.name,
                            "Prefix": json_prefix,
                            "CSV값": matched_row.get(field, ""),
                            "JSON값": json_data.get(field, "")
                        })
                        
            except Exception as e:
                print(f"파일 처리 오류 ({json_file.name}): {e}")
                unmatched_files.append(json_file.name)
        
        # 결과 정리
        return self._compile_results(results, field_accuracies, field_errors, unmatched_files)
    
    def _create_empty_result(self) -> Dict[str, Any]:
        """빈 결과 생성"""
        return {
            'overall_accuracy': 0.0,
            'total_files': 0,
            'processed_files': 0,
            'unmatched_files': [],
            'field_accuracies': {},
            'field_errors': {},
            'detailed_results': []
        }
    
    def _compile_results(self, results: List[Dict], field_accuracies: Dict, 
                        field_errors: Dict, unmatched_files: List[str]) -> Dict[str, Any]:
        """결과 컴파일"""
        
        # 전체 정확도 계산
        if results:
            overall_accuracy = sum(r['accuracy'] for r in results) / len(results)
        else:
            overall_accuracy = 0.0
        
        # 필드별 정확도 계산
        field_accuracy_means = {
            field: sum(vals) / len(vals) if vals else 0.0
            for field, vals in field_accuracies.items()
        }
        
        return {
            'overall_accuracy': overall_accuracy,
            'total_files': len(results) + len(unmatched_files),
            'processed_files': len(results),
            'unmatched_files': unmatched_files,
            'field_accuracies': field_accuracy_means,
            'field_errors': dict(field_errors),
            'detailed_results': results
        }
    
    def print_analysis_report(self, analysis_result: Dict[str, Any]):
        """분석 결과 리포트 출력"""
        print("\n" + "="*80)
        print("정확도 분석 결과")
        print("="*80)
        
        # 전체 요약
        print(f"전체 정확도: {analysis_result['overall_accuracy']:.4f} ({analysis_result['overall_accuracy']:.2%})")
        print(f"처리된 파일: {analysis_result['processed_files']}/{analysis_result['total_files']}")
        
        if analysis_result['unmatched_files']:
            print(f"매칭 실패 파일: {len(analysis_result['unmatched_files'])}개")
        
        # 필드별 정확도 (정확도 낮은 순으로 정렬)
        field_accuracies = analysis_result['field_accuracies']
        if field_accuracies:
            print("\n필드별 정확도 (정확도 낮은 순):")
            print("-" * 50)
            
            sorted_fields = sorted(field_accuracies.items(), key=lambda x: x[1])
            for field, accuracy in sorted_fields:
                print(f"{field:20s}: {accuracy:.4f} ({accuracy:.2%})")
        
        # 가장 많은 오류가 있는 필드 TOP 5
        field_errors = analysis_result['field_errors']
        if field_errors:
            print("\n오류가 많은 필드 TOP 5:")
            print("-" * 50)
            
            error_counts = [(field, len(errors)) for field, errors in field_errors.items()]
            error_counts.sort(key=lambda x: x[1], reverse=True)
            
            for field, count in error_counts[:5]:
                accuracy = field_accuracies.get(field, 0)
                print(f"{field:20s}: {count}개 오류 (정확도: {accuracy:.2%})")
    
    def visualize_results(self, analysis_result: Dict[str, Any]):
        """결과 시각화"""
        field_accuracies = analysis_result['field_accuracies']
        
        if not field_accuracies:
            print("시각화할 데이터가 없습니다.")
            return
        
        # 필드별 정확도 DataFrame 생성
        field_acc_df = pd.DataFrame.from_dict(field_accuracies, orient='index', columns=['정확도'])
        field_acc_df = field_acc_df.sort_values('정확도', ascending=True)  # 낮은 순으로 정렬
        
        # 시각화
        plt.figure(figsize=(12, 8))
        
        # 색상 설정 (정확도에 따라)
        colors = ['red' if acc < 0.8 else 'orange' if acc < 0.9 else 'green' 
                 for acc in field_acc_df['정확도']]
        
        field_acc_df.plot(kind='barh', legend=False, color=colors)
        plt.title(f"필드별 정확도 (전체 평균: {analysis_result['overall_accuracy']:.2%})")
        plt.xlabel("정확도")
        plt.xlim(0, 1)
        plt.grid(True, axis='x', alpha=0.3)
        plt.tight_layout()
        plt.show()
    
    def get_improvement_suggestions(self, analysis_result: Dict[str, Any]) -> List[str]:
        """개선 제안 생성"""
        suggestions = []
        field_accuracies = analysis_result['field_accuracies']
        field_errors = analysis_result['field_errors']
        
        # 정확도가 낮은 필드 식별
        low_accuracy_fields = [field for field, acc in field_accuracies.items() if acc < 0.8]
        
        if low_accuracy_fields:
            suggestions.append(f"정확도가 낮은 필드들을 중점적으로 개선 필요: {', '.join(low_accuracy_fields)}")
        
        # 오류가 많은 필드 식별
        high_error_fields = sorted([(field, len(errors)) for field, errors in field_errors.items()], 
                                 key=lambda x: x[1], reverse=True)[:3]
        
        if high_error_fields:
            error_field_names = [field for field, _ in high_error_fields]
            suggestions.append(f"오류가 가장 많은 필드들: {', '.join(error_field_names)}")
        
        # 전체 정확도에 따른 제안
        overall_acc = analysis_result['overall_accuracy']
        if overall_acc < 0.7:
            suggestions.append("전체 정확도가 70% 미만입니다. 프롬프트 전면 재검토가 필요합니다.")
        elif overall_acc < 0.9:
            suggestions.append("전체 정확도가 90% 미만입니다. 주요 필드에 대한 프롬프트 개선이 필요합니다.")
        
        return suggestions


def main():
    """메인 실행 함수 - 테스트용"""
    
    # 설정
    CSV_PATH = "../dataset/데이터셋/DB테이블/FRN_Vanilla_단일Payoff.csv"
    JSON_DIR = "../dataset/처리/FRN/ocr_json"
    
    try:
        # 분석기 초기화
        analyzer = AccuracyAnalyzer(CSV_PATH)
        
        # 분석 실행
        results = analyzer.analyze_json_directory(JSON_DIR)
        
        # 결과 출력
        analyzer.print_analysis_report(results)
        
        # 시각화
        analyzer.visualize_results(results)
        
        # 개선 제안
        suggestions = analyzer.get_improvement_suggestions(results)
        if suggestions:
            print("\n개선 제안:")
            for i, suggestion in enumerate(suggestions, 1):
                print(f"{i}. {suggestion}")
        
        return results
        
    except Exception as e:
        print(f"분석 오류: {e}")
        return None


if __name__ == "__main__":
    main()
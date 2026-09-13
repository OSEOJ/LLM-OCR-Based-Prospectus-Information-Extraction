# main_optimization.py
# 프롬프트 자동 최적화 메인 실행 파일

import os
from pathlib import Path
import time

# .env 파일 로드 시도
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # python-dotenv가 설치되지 않은 경우 무시
    pass

# 로컬 모듈 임포트
from txt2json import TXT2JSONConverter
from compare import AccuracyAnalyzer
from prompts import PromptOptimizer

class AutoPromptOptimizer:
    """프롬프트 자동 최적화 시스템 메인 클래스"""
    
    def __init__(self, config: dict):
        """
        Args:
            config: 설정 딕셔너리
        """
        self.config = config
        self.setup_paths()
        self.optimization_log = []
    
    def setup_paths(self):
        """경로 설정"""
        self.prompt_yaml = Path(self.config['prompt_yaml_path'])
        self.csv_path = Path(self.config['csv_path'])
        self.txt_dir = Path(self.config['txt_dir'])
        self.json_output_dir = Path(self.config['json_output_dir'])
        self.backup_dir = Path(self.config.get('backup_dir', './prompt_history'))
        
        # 디렉터리 생성
        self.json_output_dir.mkdir(parents=True, exist_ok=True)
        self.backup_dir.mkdir(parents=True, exist_ok=True)
    
    def run_optimization_cycle(self, iteration: int) -> dict:
        """
        단일 최적화 사이클 실행
        
        Args:
            iteration: 현재 반복 횟수
            
        Returns:
            사이클 결과 딕셔너리
        """
        print(f"\n{'='*60}")
        print(f"최적화 사이클 {iteration} 시작")
        print(f"{'='*60}")
        
        cycle_start_time = time.time()
        
        try:
            # 1. TXT → JSON 변환
            print(f"\n[1/3] TXT → JSON 변환 (프롬프트: {self.prompt_yaml.name})")
            converter = TXT2JSONConverter(str(self.prompt_yaml))
            
            # 샘플 파일만 처리 (빠른 테스트를 위해)
            txt_files = list(self.txt_dir.glob("*.txt"))
            sample_size = min(self.config.get('sample_size', 5), len(txt_files))
            sample_files = txt_files[:sample_size]
            
            conversion_results = {}
            for txt_file in sample_files:
                success = converter.process_txt_file(str(txt_file), str(self.json_output_dir))
                conversion_results[txt_file.name] = success
            
            success_count = sum(conversion_results.values())
            print(f"변환 완료: {success_count}/{len(sample_files)} 성공")
            
            # 2. 정확도 분석
            print(f"\n[2/3] 정확도 분석")
            analyzer = AccuracyAnalyzer(str(self.csv_path))
            analysis_result = analyzer.analyze_json_directory(str(self.json_output_dir))
            
            current_accuracy = analysis_result['overall_accuracy']
            print(f"현재 정확도: {current_accuracy:.4f} ({current_accuracy:.2%})")
            
            # 3. 프롬프트 최적화 (첫 번째 사이클이 아니고 정확도가 목표치 미만인 경우)
            improved_prompts = None
            if iteration > 1 or current_accuracy < self.config.get('target_accuracy', 0.95):
                print(f"\n[3/3] 프롬프트 최적화")
                
                optimizer = PromptOptimizer(str(self.prompt_yaml), str(self.backup_dir))
                sample_errors = optimizer.get_sample_errors(analysis_result, max_samples=3)
                
                success, improved_prompts = optimizer.optimize_prompts(analysis_result, sample_errors)
                
                if success:
                    print("프롬프트 개선 완료")
                else:
                    print("프롬프트 개선 실패")
            else:
                print(f"\n[3/3] 프롬프트 최적화 건너뜀 (목표 정확도 달성)")
            
            # 사이클 결과 정리
            cycle_time = time.time() - cycle_start_time
            
            cycle_result = {
                'iteration': iteration,
                'accuracy': current_accuracy,
                'processed_files': analysis_result['processed_files'],
                'conversion_success_rate': success_count / len(sample_files) if sample_files else 0,
                'field_accuracies': analysis_result['field_accuracies'],
                'improved': improved_prompts is not None,
                'cycle_time': cycle_time,
                'timestamp': time.strftime("%Y-%m-%d %H:%M:%S")
            }
            
            self.optimization_log.append(cycle_result)
            
            print(f"\n사이클 {iteration} 완료 (소요시간: {cycle_time:.1f}초)")
            return cycle_result
            
        except Exception as e:
            print(f"사이클 {iteration} 오류: {e}")
            return {
                'iteration': iteration,
                'accuracy': 0.0,
                'error': str(e),
                'timestamp': time.strftime("%Y-%m-%d %H:%M:%S")
            }
    
    def run_full_optimization(self) -> dict:
        """
        전체 최적화 프로세스 실행
        
        Returns:
            최종 결과 딕셔너리
        """
        print("프롬프트 자동 최적화 시스템 시작")
        print(f"설정: {self.config}")
        
        start_time = time.time()
        max_iterations = self.config.get('max_iterations', 10)
        min_improvement = self.config.get('min_improvement', 0.01)
        target_accuracy = self.config.get('target_accuracy', 0.95)
        
        best_accuracy = 0.0
        best_iteration = 0
        no_improvement_count = 0
        current_accuracy = 0.0  # 초기값 설정
        
        for iteration in range(1, max_iterations + 1):
            cycle_result = self.run_optimization_cycle(iteration)
            
            if 'error' in cycle_result:
                print(f"사이클 {iteration}에서 오류 발생, 중단")
                current_accuracy = cycle_result.get('accuracy', 0.0)
                break
            
            current_accuracy = cycle_result['accuracy']
            
            # 개선도 확인
            if current_accuracy > best_accuracy + min_improvement:
                best_accuracy = current_accuracy
                best_iteration = iteration
                no_improvement_count = 0
                print(f"새로운 최고 정확도: {best_accuracy:.4f}")
            else:
                no_improvement_count += 1
                print(f"개선 없음 ({no_improvement_count}회 연속)")
            
            # 조기 종료 조건 확인
            if current_accuracy >= target_accuracy:
                print(f"목표 정확도 달성! ({current_accuracy:.4f} >= {target_accuracy:.4f})")
                break
            
            if no_improvement_count >= 3:
                print("3회 연속 개선 없음, 최적화 중단")
                break
        
        # 최종 결과 정리
        total_time = time.time() - start_time
        
        final_result = {
            'total_iterations': len(self.optimization_log),
            'best_accuracy': best_accuracy,
            'best_iteration': best_iteration,
            'final_accuracy': current_accuracy,
            'total_time': total_time,
            'target_achieved': current_accuracy >= target_accuracy,
            'optimization_log': self.optimization_log
        }
        
        self.print_final_report(final_result)
        return final_result
    
    def print_final_report(self, final_result: dict):
        """최종 리포트 출력"""
        print(f"\n{'='*80}")
        print("프롬프트 자동 최적화 완료")
        print(f"{'='*80}")
        
        print(f"총 반복 횟수: {final_result['total_iterations']}")
        print(f"최고 정확도: {final_result['best_accuracy']:.4f} ({final_result['best_accuracy']:.2%}) - 반복 {final_result['best_iteration']}")
        print(f"최종 정확도: {final_result['final_accuracy']:.4f} ({final_result['final_accuracy']:.2%})")
        print(f"목표 달성: {'Yes' if final_result['target_achieved'] else 'No'}")
        print(f"총 소요 시간: {final_result['total_time']:.1f}초")
        
        # 반복별 정확도 변화
        print(f"\n반복별 정확도 변화:")
        print("-" * 40)
        for log in final_result['optimization_log']:
            if 'accuracy' in log:
                marker = " ★" if log['iteration'] == final_result['best_iteration'] else ""
                print(f"반복 {log['iteration']:2d}: {log['accuracy']:.4f} ({log['accuracy']:.2%}){marker}")


def main():
    """메인 실행 함수"""
    
    # 설정
    config = {
        # 파일 경로
        'prompt_yaml_path': './prompts/prompts_FRN.yaml',
        'csv_path': '../dataset/데이터셋/DB테이블/FRN_Vanilla_단일Payoff.csv',
        'txt_dir': '../dataset/처리/FRN/ocr_output',
        'json_output_dir': '../dataset/처리/FRN/ocr_json',
        'backup_dir': './prompt_history',
        
        # 최적화 파라미터
        'max_iterations': 10,        # 최대 반복 횟수
        'min_improvement': 0.01,     # 최소 개선율 (1%)
        'target_accuracy': 0.95,     # 목표 정확도 (95%)
        'sample_size': 5,            # 테스트용 샘플 파일 수
    }
    
    # 환경변수 확인 및 설정
    if not os.getenv('OPENAI_API_KEY'):
        print("오류: OPENAI_API_KEY 환경변수가 설정되지 않았습니다.")
        print("\n다음 중 하나의 방법으로 설정하세요:")
        print("1. 터미널에서: export OPENAI_API_KEY='your-api-key-here'")
        print("2. 아래에서 직접 입력")
        
        # 직접 입력 옵션 제공
        user_input = input("\nAPI 키를 직접 입력하시겠습니까? (y/n): ").lower().strip()
        if user_input == 'y':
            api_key = input("OpenAI API 키를 입력하세요: ").strip()
            if api_key:
                os.environ['OPENAI_API_KEY'] = api_key
                print("API 키가 설정되었습니다.")
            else:
                print("유효한 API 키를 입력해주세요.")
                return
        else:
            return
    
    try:
        # 최적화 시스템 초기화 및 실행
        optimizer = AutoPromptOptimizer(config)
        final_result = optimizer.run_full_optimization()
        
        # 결과 저장 (선택사항)
        import json
        result_file = Path('./optimization_result.json')
        with open(result_file, 'w', encoding='utf-8') as f:
            json.dump(final_result, f, ensure_ascii=False, indent=2)
        print(f"\n결과 저장: {result_file}")
        
    except Exception as e:
        print(f"실행 오류: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()

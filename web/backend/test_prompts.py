"""프롬프트 조회 회귀 테스트.
UI는 'frn'/'irs' 소문자 id 를 보내고 YAML 키는 'FRN'/'IRS' 대문자다.
이 불일치가 다시 생기면 여기서 깨진다.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from services.llm_service import PromptManager

pm = PromptManager(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "prompts", "prompts.yaml"))

products = pm.get_supported_products()
assert set(products) == {"bond_forward", "FRN", "IRS"}, products

for pid in ["bond_forward", "frn", "FRN", "irs", "IRS", "Bond_Forward"]:
    t = pm.get_prompt(pid)
    assert t and "{{text}}" in t, f"{pid}: 템플릿 이상"

# 길이로 구버전 프롬프트가 실제로 이식됐는지 확인
lens = {p: len(pm.get_prompt(p)) for p in ["bond_forward", "frn", "irs"]}
assert lens["bond_forward"] > 5000 and lens["frn"] > 5000 and lens["irs"] > 10000, lens

try:
    pm.get_prompt("crs")
    raise AssertionError("crs 는 프롬프트가 없어야 한다")
except KeyError:
    pass

print("OK 프롬프트 조회:", lens)
print("OK 대소문자 무시 조회 / 미정의 상품은 KeyError")

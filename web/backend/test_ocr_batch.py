"""배치 OCR WebSocket 회귀 테스트.
OCR 엔진은 스텁으로 대체하고, /ws/ocr-batch 의 메시지 계약만 검증한다.
- 여러 파일이 각각 file_progress / file_complete 를 file_id 태깅과 함께 받는가
- 검증 실패 파일이 file_error 로 격리되어 나머지 파일을 막지 않는가
"""
import base64, os, sys
os.environ.setdefault("OPENAI_API_KEY", "dummy-for-import-check")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import main
from fastapi.testclient import TestClient

# 검증 통과 조건: %PDF-1.x 헤더, 1000바이트 이상, %%EOF 포함
PDF = b"%PDF-1.4\n" + b"x" * 1200 + b"\n%%EOF"


class FakeOCR:
    async def ocr_preview(self, path, progress_callback=None):
        for i in (1, 2):
            await progress_callback({
                "current": i, "total": 2, "message": f"{i}페이지 OCR 완료",
                "page": i, "total_pages": 2,
            })
        return {
            "total_pages": 2, "successful_pages": 2, "success_rate": 100.0,
            "page_results": [], "preview_text": "추출된 본문",
        }

    async def process_file_with_method(self, path, method):
        return "docx 본문"


class FakeFiles:
    def determine_processing_method(self, path):
        return "ocr"


main.ocr_service = FakeOCR()
main.file_service = FakeFiles()

b64 = base64.b64encode(PDF).decode()
client = TestClient(main.app)

with client.websocket_connect("/ws/ocr-batch") as ws:
    ws.send_json({"action": "start_batch", "files": [
        {"file_id": "a_1_x", "filename": "a.pdf", "file_data": b64},
        {"file_id": "b_2_y", "filename": "b.pdf", "file_data": b64},
        {"file_id": "c_3_z", "filename": "bad.exe", "file_data": b64},
    ]})

    # 정상 2파일 x (진행 2 + 완료 1) + 검증실패 1 = 7건
    seen = {}
    for i in range(7):
        msg = ws.receive_json()
        print(f"  [{i}] {msg['type']} {msg['data'].get('file_id')}", flush=True)
        seen.setdefault(msg["type"], []).append(msg["data"]["file_id"])

assert sorted(set(seen["file_complete"])) == ["a_1_x", "b_2_y"], seen
assert seen["file_error"] == ["c_3_z"], seen
assert sorted(set(seen["file_progress"])) == ["a_1_x", "b_2_y"], seen
assert len(seen["file_progress"]) == 4, seen["file_progress"]

print("OK 배치 메시지 계약:", {k: len(v) for k, v in seen.items()})
print("OK 검증 실패 파일 격리: 나머지 2건 정상 완료")

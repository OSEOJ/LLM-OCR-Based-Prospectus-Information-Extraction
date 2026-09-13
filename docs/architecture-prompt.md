# 아키텍처 다이어그램 생성 프롬프트

README의 아키텍처 그림을 다시 만들거나, 다른 프로젝트에 같은 형식으로 만들 때 쓰는 프롬프트입니다.

## 먼저 알아둘 것

**기술 다이어그램에 이미지 생성 모델(DALL·E, Midjourney, Stable Diffusion)을 쓰지 마세요.**
박스와 화살표는 그럴듯하게 그리지만 글자를 반드시 뭉갭니다. `/ws/ocr-batch` 같은 문자열이
`/ws/ocn-batoh` 로 나오고, 그걸 고칠 방법이 없습니다. 커밋해 두면 읽는 사람이 오해합니다.

대신 **코드를 생성하는 LLM에게 Mermaid나 SVG를 받으세요.** 글자가 정확하고, diff가 남고,
GitHub이 Mermaid를 자체 렌더링하므로 이미지 파일을 따로 관리할 필요도 없습니다.

- **프롬프트 A** — Mermaid 코드 생성 (권장, README에 바로 사용)
- **프롬프트 B** — SVG 코드 생성 (발표자료·인쇄물 등 정밀 제어가 필요할 때)
- **프롬프트 C** — 이미지 모델용 (배너·썸네일 전용. 글자를 넣지 않는 용도로만)

---

## 프롬프트 A — Mermaid (권장)

> 아래 `[ ]` 부분만 자기 프로젝트에 맞게 바꿔 쓰면 됩니다.

```text
너는 오픈소스 저장소의 README에 넣을 아키텍처 다이어그램을 만든다.
Mermaid `flowchart` 코드만 출력하고, 설명 문장은 붙이지 마라.

## 프로젝트
[한 문장 설명. 예: 금융 파생상품 텀시트를 OCR과 LLM으로 읽어 구조화된 JSON으로 변환하는 파이프라인]

## 담아야 할 구성요소
[실제 파일·엔드포인트·라이브러리 이름을 그대로 적는다. 추상적인 "서비스 레이어" 같은 말 금지]
- 진입점: [예: React 업로드 UI / CLI 명령]
- 전송: [예: WebSocket /ws/ocr-preview(단일), /ws/ocr-batch(일괄), REST /api/convert]
- 분기 조건: [예: 스캔본이면 OCR, 텍스트 레이어가 있으면 직접 추출]
- 처리: [예: OCRService(EasyOCR, 문자 좌표로 표 행 복원) / PyMuPDF·python-docx 직접 추출]
- 외부 의존: [예: OpenAI API, prompts.yaml(상품별·버전별)]
- 산출물: [예: JSON + field_mappings(각 필드의 원문 위치)]
- 종점: [예: 원문 하이라이트 검수 화면 → JSON·TXT·ZIP 다운로드]

## 규칙
1. `flowchart LR` 로 시작한다. 한 화면에 가로로 읽히게 만든다.
2. 처리 단계를 `subgraph` 로 3~5개 묶고, 제목에 `① ② ③` 번호를 붙여 순서를 드러낸다.
3. 조건 분기는 마름모 `{ }` 로, 데이터 저장소는 `[( )]` 로, 외부 API는 `[[ ]]` 로 표기한다.
4. 노드 안 줄바꿈은 `<br/>` 를 쓴다. 한 노드는 최대 3줄.
5. 노드 라벨에 실제 이름을 쓴다 — 클래스명, 엔드포인트 경로, 파일명, 라이브러리명.
   "데이터 처리", "비즈니스 로직" 같은 일반명사는 쓰지 마라.
   다만 임계값·타임아웃·재시도 횟수 같은 튜닝 가능한 숫자는 넣지 마라.
   바뀌면 그림이 거짓말이 되고, 읽는 사람에게도 그 수치는 필요 없다.
   "스캔본인가?" 로 충분하지 "텍스트 레이어 70% 이상?" 까지 갈 필요는 없다.
6. 분기 화살표에는 조건을 라벨로 단다. 예: `-->|텍스트 레이어 있음|`
7. 비동기 알림·피드백 경로는 점선 `-.->` 로 구분한다.
8. 노드는 15개를 넘기지 마라. 넘으면 다이어그램을 2개로 나눈다.
9. 색상 지정(`style`, `classDef`)은 하지 마라. GitHub의 라이트/다크 테마가 알아서 처리한다.

## 검증
출력하기 전에 스스로 확인하라.
- 시작 노드에서 종점까지 화살표만 따라가서 도달하는가?
- 고아 노드가 있는가?
- 단계 번호 순서와 실제 배치 방향이 어긋나지 않는가?
  (어긋나면 노드를 다른 subgraph 로 옮겨 정렬을 맞춘다)
```

### 렌더링해서 확인하기

LLM이 준 코드는 문법이 맞아도 배치가 틀어질 수 있습니다. 반드시 실제로 그려 보세요.

```bash
npx @mermaid-js/mermaid-cli -i diagram.mmd -o diagram.png -w 1900 -b white
```

배치가 어색하면 `flowchart LR` ↔ `TB` 를 바꾸거나, 순서가 어긋난 노드를 앞 단계 subgraph로
옮기면 대개 해결됩니다.

---

## 프롬프트 B — SVG

Mermaid의 자동 배치가 마음에 들지 않거나, 발표자료용으로 여백·정렬을 직접 잡아야 할 때.

```text
아래 시스템의 아키텍처 다이어그램을 손으로 작성한 SVG 코드로 만들어라. SVG만 출력하라.

## 시스템
[프롬프트 A의 "프로젝트"와 "담아야 할 구성요소"를 그대로 붙여넣는다]

## 규칙
1. viewBox="0 0 1600 700", `width`/`height` 속성은 두지 마라 (반응형).
2. 색은 CSS 변수로 정의하고 `@media (prefers-color-scheme: dark)` 에서 재정의하라.
   GitHub 다크 테마에서 글자가 안 보이면 안 된다.
3. 폰트는 `font-family="system-ui, -apple-system, sans-serif"`, 본문 14px 이상.
4. 한글이 들어가므로 텍스트를 `<text>` 로 넣되, 글자 잘림을 막기 위해 박스 폭을
   글자 수 × 9px + 32px 이상으로 잡아라.
5. 화살표는 `<marker>` 로 머리를 정의해 재사용하라.
6. 좌→우 흐름. 단계 구분은 옅은 배경의 `<rect>` 와 상단 라벨로 표현하라.
7. 장식용 그라디언트·그림자·아이콘은 넣지 마라.
```

---

## 프롬프트 C — 이미지 모델 (배너 전용)

저장소 상단 배너나 소셜 카드용. **글자는 별도 레이어에서 직접 얹으세요.**

```text
Minimal technical illustration for a document-processing pipeline.
Flat vector style, muted indigo and slate palette on an off-white background.
Abstract shapes suggesting: a stack of paper documents on the left, a scanning
grid in the middle, structured data blocks on the right, connected by thin
horizontal lines. Clean geometric composition, generous whitespace,
wide banner aspect ratio 3:1. No text, no letters, no numbers, no logos.
```

마지막 문장(`No text...`)을 빼면 반드시 깨진 글자가 섞여 나옵니다.

---
name: art-tool-builder
description: "Auto-generates Art Studio local web tool for asset review/regeneration/replacement. Used at Phase 4 start."
context: fork
agent: general-purpose
allowed-tools: Bash(node *), Write, Read
---

# art-tool-builder.md — Art Studio 도구 자동 생성 스킬

> **Phase:** 4 (art-worker 모드 2 실행 직전에 실행)
> **입력:** `docs/art-direction.md`, `asset-manifest.json`
> **출력:** `art-studio/` 폴더 (로컬 웹 도구)

---

## 역할

에셋 검수·재생성·교체·버전 관리를 위한 **로컬 웹 도구**를 프로젝트 내에 자동 생성한다.
이 도구는 브라우저에서 열어 사용하며, Gemini API를 직접 호출하여 이미지를 재생성한다.
**재생성 시 후처리(배경 제거 → 리사이즈)가 자동 적용된다.**

---

## 생성할 파일 구조

```
art-studio/
├── index.html          ← 단일 파일 앱 (HTML + CSS + JS 인라인)
├── studio-server.js    ← 로컬 API 서버 (Node.js, Gemini 호출 + 후처리 중계)
├── history/            ← 버전 히스토리 이미지 저장
│   └── originals/      ← 후처리 전 원본 보관
├── history.json        ← 버전별 프롬프트/레퍼런스 기록
└── README.md           ← 사용법 안내
```

---

## studio-server.js 명세

로컬에서 실행되는 간단한 Node.js 서버. Art Studio UI의 백엔드.

### 엔드포인트

```
POST /api/generate
  body: { asset_id, prompt, reference_image_path, size, aspect_ratio }
  → 1. 예산 확인 (usage.json)
  → 2. Gemini 이미지 생성 API 호출 (aspect_ratio 적용)
  → 3. 원본을 history/originals/에 저장
  → 4. 배경 제거 (background 카테고리 제외)
  → 5. 리사이즈 (asset-manifest의 size 기준)
  → 6. 처리된 이미지를 history/에 저장
  → 7. usage.json에 비용 기록
  → { image_path, original_path, version, cost_usd }

POST /api/adopt
  body: { asset_id, version }
  → history에서 해당 버전 이미지를 assets/ 폴더로 복사
  → asset-manifest.json의 status를 "adopted"로 업데이트
  → 이전 채택 이미지는 history로 이동

POST /api/restore
  body: { asset_id, version }
  → history에서 이전 버전을 다시 채택
  → asset-manifest.json 업데이트

POST /api/regenerate-batch
  body: { asset_ids, reference_image_path }
  → 선택된 에셋들을 순차적으로 재생성 (2초 간격)
  → 각각 후처리(배경 제거 → 리사이즈) 자동 적용
  → { results: [{ asset_id, image_path, version, cost_usd }] }

GET /api/manifest
  → asset-manifest.json 내용 반환

GET /api/budget
  → usage.json의 summary 반환

GET /api/history/:asset_id
  → 해당 에셋의 버전 히스토리 반환

GET /api/original/:asset_id/:version
  → 후처리 전 원본 이미지 반환 (비교 확인용)
```

### Gemini 호출 규칙

studio-server.js 내부의 이미지 생성 로직은 반드시 다음을 준수한다:
1. `.reference/gemini_image_workflow.md`의 6대 원칙
2. `skills/cost-tracker.md`의 예산 확인
3. `.env.local`에서 API 키 로드
4. `asset-manifest.json`의 `aspect_ratio` 필드를 `image_config`에 적용

### 후처리 파이프라인

studio-server.js 내부의 후처리 로직은 `.reference/image-pipeline.md`를 따른다:

```
생성 완료 (Gemini 출력)
    ↓
원본 보관 → history/originals/{asset_id}_{version}_original.png
    ↓
배경 제거 (background 카테고리가 아닌 경우만)
  - threshold: 80
  - 탐색: 8방향 BFS
  - 안티앨리어싱 적용
    ↓
리사이즈 (asset-manifest의 size 기준)
  - 리샘플링: LANCZOS
  - PNG 최적화
    ↓
처리된 이미지 → history/{asset_id}_{version}.png
```

---

## index.html (Art Studio UI) 명세

### 레이아웃

```
┌──────────────────────────────────────────────────────────────┐
│  Art Studio: [프로젝트명]              Budget: $X.XX/$Y.YY   │
├──────────┬───────────────────────────────────────────────────┤
│ 에셋 목록 │  미리보기 영역                                    │
│          │  ┌────────────┐  ┌────────────┐                   │
│ [카테고리]│  │ 현재 적용   │  │ 새로 생성   │                   │
│ character│  │            │  │ (미리보기)  │                   │
│  ● hero  │  └────────────┘  └────────────┘                   │
│    -idle │                                                   │
│    -run  │  [원본 보기] ← 후처리 전 원본 토글               │
│ monster  │                                                   │
│  ○ slime │  프롬프트 편집:                                    │
│ ui       │  ┌─────────────────────────────────────────┐      │
│  ○ btn   │  │ (수정 가능한 텍스트 영역)                │      │
│          │  └─────────────────────────────────────────┘      │
│          │                                                   │
│          │  비율: [3:4 ▼]  레퍼런스: [현재] [변경]           │
│          │                                                   │
│          │  [재생성 $0.039] [채택→교체] [복원]               │
│          │                                                   │
│          │  ── 히스토리 ─────────────────────                │
│          │  v3 ✓적용  │  v2 기각  │  v1 기각                 │
│          │  [썸네일]   │  [썸네일] │  [썸네일]                │
│──────────│                                                   │
│[카테고리  │  ── 일괄 작업 ───────────────────                │
│ 전체선택] │  [선택 항목 일괄 재생성] (예상: $X.XX)            │
└──────────┴───────────────────────────────────────────────────┘
```

### 핵심 기능

**1. 개별 재생성**
- 에셋 선택 → 프롬프트 수정(선택) → 비율 변경(선택) → [재생성] 클릭
- 버튼에 예상 비용 표시 ($0.039)
- 생성 중 로딩 스피너 표시 (후처리 포함 진행 상태)
- 생성 완료 → 후처리 완료된 이미지와 현재 이미지 나란히 비교
- [원본 보기] 토글로 후처리 전 원본 확인 가능

**2. 비율 변경**
- 드롭다운으로 생성 비율 변경 가능 (1:1, 3:4, 4:3, 9:16, 16:9 등)
- 변경 시 재생성해야 적용됨 (기존 이미지는 그대로)
- 비율 변경 시 "리사이즈 결과가 달라질 수 있습니다" 안내

**3. 채택/교체**
- [채택→교체] 클릭 → 새 이미지가 assets/ 폴더의 실제 파일을 교체
- 이전 이미지는 history/에 보관
- asset-manifest.json 자동 업데이트

**4. 버전 복원**
- 히스토리에서 이전 버전 클릭 → [복원] 가능
- 복원 시 현재 채택 이미지를 history로, 선택 버전을 assets/로

**5. 레퍼런스 변경**
- [변경] 버튼 → 파일 선택 다이얼로그 또는 다른 에셋 선택
- 레퍼런스 변경 후 재생성하면 다른 스타일로 생성됨

**6. 일괄 재생성**
- 카테고리별 전체 선택 체크박스
- [선택 항목 일괄 재생성] → 예상 비용 표시 → 컨펌 후 실행
- 진행률 표시 (3/10 완료...)
- 각 에셋마다 후처리 자동 적용

**7. 예산 모니터링**
- 헤더에 실시간 예산 잔액 표시
- 90% 도달 시 경고색(노랑), 100% 도달 시 빨강 + 생성 버튼 비활성화

**8. 원본 비교**
- [원본 보기] 토글 → 후처리 전/후 이미지 비교
- 배경 제거가 잘못된 경우 확인 가능
- 원본에서 재후처리 요청 가능 (threshold 조정 등)

---

## history.json 스키마

```json
{
  "hero-idle": {
    "current_version": "v3",
    "versions": [
      {
        "version": "v1",
        "file": "history/hero-idle_v1.png",
        "original": "history/originals/hero-idle_v1_original.png",
        "prompt": "사용된 프롬프트",
        "reference": "사용된 레퍼런스 경로",
        "aspect_ratio": "3:4",
        "cost_usd": 0.039,
        "created_at": "2026-02-16T10:00:00Z",
        "status": "rejected",
        "post_processing": {
          "bg_removed": true,
          "resized_to": "48x64",
          "resize_method": "LANCZOS"
        }
      }
    ]
  }
}
```

---

## README.md 내용

```markdown
# Art Studio 사용법

## 실행
node art-studio/studio-server.js

서버가 시작되면 브라우저에서 http://localhost:3333 접속

## 워크플로우
1. 왼쪽 에셋 목록에서 에셋 선택
2. 프롬프트 확인/수정, 비율 확인
3. [재생성]으로 새 이미지 생성 (후처리 자동 적용)
4. [원본 보기]로 후처리 전 이미지 확인 가능
5. 마음에 들면 [채택→교체]
6. 모든 에셋 확인 후 Claude Code로 돌아가서 '컨펌'

## 이미지 처리 파이프라인
재생성할 때마다 자동으로:
1. Gemini가 이미지 생성 (지정된 비율로)
2. 원본을 history/originals/에 보관
3. 배경 제거 (배경 에셋 제외)
4. 게임 크기로 리사이즈
5. 처리된 이미지를 미리보기에 표시

## 주의사항
- 예산 한도를 확인하세요 (우측 상단)
- .env.local에 GOOGLE_API_KEY가 설정되어 있어야 합니다
- 모든 히스토리는 art-studio/history/에 보존됩니다
- 원본 이미지도 history/originals/에 보존됩니다
```

---

## 생성 시 주의사항

- Art Studio는 **프로젝트별**로 생성된다. 글로벌 도구가 아니다.
- studio-server.js의 Gemini 호출 코드는 `tools/gemini-image.ts`를 참고하되,
  독립적으로 동작해야 한다 (Art Studio만 단독 실행 가능).
- 후처리 로직(배경 제거, 리사이즈)도 서버 내에 포함한다.
  `.reference/image-pipeline.md`의 알고리즘을 구현한다.
- CORS 설정: localhost만 허용.
- 파일 접근: 프로젝트 루트의 assets/, art-studio/history/ 에만 쓰기 가능.

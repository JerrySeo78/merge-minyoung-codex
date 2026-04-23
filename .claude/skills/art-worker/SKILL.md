---
name: art-worker
description: "Extracts, generates (Gemini API), post-processes (bg remove/resize), and binds game assets. Used in Phase 4."
context: fork
agent: general-purpose
allowed-tools: Bash(node *), Bash(python *), Write, Read, Grep, Glob
---

# art-worker — 아트 에셋 생성 파이프라인 스킬

> **Phase 3~6 상세 가이드:** [phase-guide.md](phase-guide.md) (동적 스킬 생성 규칙, QA 체크리스트, 배포 릴리즈 노트 형식)

> **Phase:** 1 (모드 1만), 4 (모드 2, 3)
> **의존:** `.reference/gemini_image_workflow.md` (원칙 고정)
> **의존:** `.reference/image-pipeline.md` (후처리 파이프라인)
> **의존:** `skills/cost-tracker.md` (모든 API 호출 전 예산 확인)

---

## 역할

게임의 아트 에셋을 기획하고, 생성하고, 후처리하고, 코드에 바인딩하는 전체 파이프라인을 수행한다.
3가지 모드로 나뉘며, 각 모드는 다른 Phase에서 실행된다.

---

## 모드 1: 아트 디렉션 수립 (Phase 1에서 실행)

### 트리거
`skills/game-planner.md`와 함께 Phase 1에서 실행된다.

### 동작
1. 사용자의 게임 아이디어와 장르를 분석한다.
2. 적합한 아트 스타일을 제안한다.
3. `docs/art-direction.md`를 생성한다.

### 주의
- 이 단계에서 에셋 목록은 만들지 않는다. 코드가 없으므로 정확한 목록을 알 수 없다.
- 스타일, 톤, 팔레트, 크기 규격 등 "방향"만 정의한다.
- 레퍼런스 이미지가 있으면 `reference-images/` 폴더에 저장한다.

---

## 모드 2: 에셋 추출 + 생성 + 후처리 (Phase 4에서 실행)

### 트리거
Phase 3 (코딩) 완료 후, 사용자 컨펌이 있을 때 실행된다.

### Step 2-1: 코드 스캔 및 에셋 추출

완성된 코드 전체를 스캔하여 에셋 참조를 추출한다.

**스캔 대상 패턴:**
```typescript
// Phaser 에셋 로딩 패턴들
this.load.image('키', '경로')
this.load.spritesheet('키', '경로', { frameWidth, frameHeight })
this.load.atlas('키', '경로', '데이터경로')
this.load.audio('키', '경로')  // 사운드는 생성 대상 아님, 목록에만 기록
```

**추출 결과 → `asset-manifest.json` 생성:**

각 에셋에 대해 다음 정보를 기록한다:
- `id`: 코드에서 사용하는 키 이름
- `path`: 코드에 작성된 파일 경로
- `category`: 코드 컨텍스트에서 유추 (character/monster/object/background/ui/platform/item)
- `size`: 코드에 명시된 크기 또는 `art-direction.md`의 카테고리별 규격
- `aspect_ratio`: 카테고리와 크기에서 산출한 생성 비율 (아래 매핑 참조)
- `source_file`: 이 에셋을 참조하는 소스 파일명
- `source_line`: 소스 파일 내 라인 번호
- `status`: `pending`으로 초기화
- `prompt`: (다음 Step에서 채움)
- `reference_image`: (레퍼런스 체이닝에서 채움)

### 생성 비율 (aspect_ratio) 매핑

에셋의 게임 내 크기(가로x세로)에서 가장 가까운 비율을 자동 산출한다.

**카테고리별 기본 매핑:**

| 카테고리 | 전형적 크기 | 비율 방향 | 생성 비율 |
|---------|-----------|----------|----------|
| character | 48x64 등 세로형 | 세로 > 가로 | `3:4` |
| monster | 48x48 등 정방형 | 정방형 | `1:1` |
| object/item | 46x46, 64x64 | 정방형 | `1:1` |
| platform | 80x80, 80x24 등 | 가로 ≥ 세로 | `1:1` 또는 `4:3` |
| background | 400x720 (세로 게임) | 세로 > 가로 | `9:16` |
| background | 960x640 (가로 게임) | 가로 > 세로 | `16:9` |
| ui | 64x64, 120x120 | 정방형 | `1:1` |

**자동 산출 규칙:**
```
ratio = width / height

ratio ≈ 1.0  → "1:1"
ratio ≈ 0.75 → "3:4"
ratio ≈ 1.33 → "4:3"
ratio ≈ 0.56 → "9:16"
ratio ≈ 1.78 → "16:9"
ratio ≈ 0.80 → "4:5"
ratio ≈ 1.25 → "5:4"
ratio ≈ 0.67 → "2:3"
ratio ≈ 1.50 → "3:2"
```

가장 가까운 지원 비율을 선택한다.
**지원 비율:** `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `3:2`, `2:3`, `4:5`, `5:4`, `21:9`

디렉터가 특정 에셋의 비율을 직접 지정할 수도 있다.

### Step 2-2: 프롬프트 자동 작성

`docs/art-direction.md`를 읽고, 각 에셋에 맞는 이미지 생성 프롬프트를 작성한다.

**프롬프트 구성 공식:**
```
[아트 스타일] + [에셋 설명] + [크기] + [배경 처리] + [톤/팔레트]
```

**예시:**
```
"pixel art, 3-head-tall SD character, hero idle standing pose,
simple leather armor, 16-color palette, bright casual tone,
transparent background, 48x64 pixels"
```

**규칙:**
- 프롬프트는 영문으로 작성한다 (Gemini 이미지 생성 품질)
- 배경이 있는 에셋(background 카테고리)을 제외하고 모두 `transparent background` 명시
- 프롬프트 길이는 480 토큰 이내

`asset-manifest.json`의 각 에셋 `prompt` 필드를 채운다.

**사용자 컨펌:** 프롬프트 목록과 생성 비율을 사용자에게 보여주고 수정/승인을 요청한다.

### Step 2-3: 스타일 앵커 생성

**가장 중요한 에셋 1개**를 먼저 생성한다.
보통 `art-direction.md`의 "스타일 앵커"에 지정된 에셋 (기본: 주인공 캐릭터).

**Gemini 이미지 생성 호출 절차:**

반드시 `.reference/gemini_image_workflow.md`의 원칙을 따른다:

```
1. 비용 확인 (cost-tracker)
2. 레퍼런스 이미지 로드 (있으면)
3. contents 배열 구성:
   contents = [
     reference_image,    ← 이미지가 텍스트보다 먼저 (절대 원칙)
     prompt_text          ← 텍스트가 마지막
   ]
4. config 설정:
   response_modalities = ["IMAGE"]  (필수)
   image_config로 크기/비율 지정:
     image_size = "1K" 또는 "2K"
     aspect_ratio = asset-manifest의 해당 에셋 비율 사용
5. API 호출 (재시도 + Exponential Backoff)
6. 응답 다층 검증 (candidates → content → parts → inline_data → data)
7. PNG 저장 + 비용 기록
```

**사용자 컨펌:** 생성된 스타일 앵커를 보여주고 승인을 요청한다.
- 승인 → Step 2-4로 진행
- 거부 → 프롬프트 수정 또는 레퍼런스 변경 후 재생성

### Step 2-4: 나머지 에셋 일괄 생성

**생성 순서 (스타일 일관성을 위해):**
1. 같은 카테고리의 다른 에셋 (주인공의 다른 포즈 등)
2. 관련 카테고리 (몬스터 → 주인공을 레퍼런스로)
3. 오브젝트, 아이템
4. 플랫폼
5. 배경
6. UI 에셋

**레퍼런스 적용 우선순위:**
```
1. asset.reference_image (매니페스트에 명시된 개별 레퍼런스)
2. 스타일 앵커 이미지
3. 레퍼런스 없음 (프롬프트만으로 생성)
```

이모션/변형 이미지는 반드시 해당 기본 캐릭터를 `reference_image`로 지정한다.

**contents 배열 구성 (레퍼런스 체이닝 시):**
```
# 개별 레퍼런스가 있을 때
contents = [
    specific_reference_image,    ← 개별 레퍼런스 (최우선)
    prompt_text
]

# 개별 레퍼런스 없고 스타일 앵커만 있을 때
contents = [
    style_anchor_image,          ← 스타일 앵커
    prompt_text
]
```

**에셋 간 생성 간격:** Rate Limiting 방지를 위해 에셋 사이 2초 대기.
**생성 단가:** 에셋당 약 $0.039 (2026-02-16 기준, 웹 검색으로 최신 단가 확인)

각 에셋 생성 후 `asset-manifest.json`의 status를 `generated`로 업데이트한다.

### Step 2-5: 후처리 파이프라인

이미지 생성 완료 후, 게임에서 사용할 수 있도록 후처리를 수행한다.
**순서가 중요하다: 배경 제거 → 리사이즈** (큰 이미지에서 배경 제거하는 것이 품질이 좋다)

상세 구현은 `.reference/image-pipeline.md`를 참조한다.

#### 후처리 1: 배경 제거

**대상:** background 카테고리를 **제외한** 모든 에셋
**방법:** 가장자리 색상 샘플링 → Flood Fill BFS (8방향) → 안티앨리어싱

```
실행: node tools/remove-bg.js
- threshold: 80 (40은 너무 낮아 배경 잔여 발생)
- 탐색 방향: 8방향 (4방향은 대각선 경계에서 배경 남음)
- 안티앨리어싱: 경계 부드럽게 처리
```

**핵심 교훈:**
- threshold 40은 너무 낮음 → 80 사용
- 4방향은 부족 → 8방향 필수
- 밝고 채도 낮은 영역은 추가 판별 (밝기 > 220 AND 채도 < 0.12)

#### 후처리 2: 리사이즈

**대상:** 모든 에셋 (Gemini 출력은 항상 큰 이미지)
**방법:** 카테고리별 목표 크기로 LANCZOS 리샘플링

```
실행: python resize_assets.py (또는 node tools/resize-assets.js)
- 원본 백업: .png.backup 으로 보존 (첫 실행 시만)
- 리샘플링: LANCZOS (고품질)
- PNG 최적화: optimize=True
```

**카테고리별 목표 크기는 `art-direction.md`의 크기 규격을 따른다.**

**핵심 교훈:**
- 리사이즈 전 배경 제거가 먼저 (품질)
- 이모션/변형도 기본 캐릭터와 동일 크기로 (로딩 실패 방지)
- 이미 목표 크기인 파일은 자동 스킵
- .png.backup으로 원본 복원 가능

### 전체 생성 파이프라인 요약

```
코드 스캔 → asset-manifest.json 생성
    ↓
프롬프트 작성 + 비율 매핑 → 디렉터 컨펌
    ↓
스타일 앵커 생성 → 디렉터 컨펌
    ↓
나머지 에셋 일괄 생성 (레퍼런스 체이닝, 비율 적용)
    ↓
배경 제거 (비배경 에셋만, threshold 80, 8방향)
    ↓
리사이즈 (카테고리별 목표 크기, LANCZOS, 원본 백업)
    ↓
디렉터 검수 (Art Studio 사용)
    ↓
바인딩
```

---

## 모드 3: 코드 바인딩 (Phase 5에서 실행)

### 트리거
Phase 4 완료 후 (모든 에셋 사용자 컨펌 완료).

### 동작

1. `asset-manifest.json`을 읽는다.
2. 모든 에셋의 status가 `adopted` 또는 `generated`인지 확인한다.
3. 각 에셋의 `path`에 실제 파일이 존재하는지 확인한다.
4. **리사이즈가 완료되었는지 확인한다** (파일 크기가 목표 크기와 일치하는지).
5. 누락 에셋이 있으면 목록을 보고한다.
6. 모든 에셋이 존재하면 status를 `bound`로 업데이트한다.
7. `npm run build`를 실행하여 에셋 참조 오류가 없는지 확인한다.

### 누락 처리
```
누락 에셋 발견 시:
1. 목록 출력: "[에셋ID]가 [경로]에 없습니다"
2. 원인 분석: 생성 실패? 후처리 실패? 경로 불일치? 코드 변경?
3. 해결 제안: 재생성 / 후처리 재실행 / 경로 수정 / 코드 수정
```

---

## asset-manifest.json 스키마

```json
{
  "art_direction": "docs/art-direction.md",
  "style_anchor": "에셋 ID (스타일 기준 에셋)",
  "assets": [
    {
      "id": "에셋 키 (코드의 load key)",
      "path": "assets/파일경로.png",
      "category": "character|monster|object|item|background|ui|platform",
      "size": "WxH (게임 내 최종 크기)",
      "aspect_ratio": "3:4 (생성 시 사용할 비율)",
      "prompt": "생성 프롬프트",
      "reference_image": "레퍼런스로 사용할 이미지 경로 (없으면 빈 문자열)",
      "status": "pending|generated|adopted|bound",
      "source_file": "이 에셋을 참조하는 소스 파일",
      "source_line": 0
    }
  ]
}
```

---

## 절대 준수 사항

1. **이미지를 텍스트보다 먼저 배치** — contents 배열에서 이미지가 항상 앞
2. **`response_modalities=["IMAGE"]` 필수** — 누락 시 텍스트 응답 가능
3. **재시도 + Exponential Backoff** — 최대 3회, 2초·4초·8초
4. **응답 다층 검증** — candidates → content → parts → inline_data → data
5. **모든 호출 전 예산 확인** — `cost-tracker.md` 경유
6. **모델명은 웹 검색 우선** — 원칙만 고정, 모델명/파라미터는 최신값
7. **후처리 순서: 배경 제거 → 리사이즈** — 순서 바꾸면 품질 저하
8. **비율 매핑 적용** — 에셋 카테고리별 생성 비율로 변형 최소화

이 중 1~6은 `.reference/gemini_image_workflow.md`에서, 7~8은 `.reference/image-pipeline.md`에서 유래하며 절대 변경하지 않는다.

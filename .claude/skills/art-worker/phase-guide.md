# Phase 3~6 상세 가이드

## Phase 3: 코드 생성

**자동 실행 범위:**
1. 기술 스택 확정 + 기록 (`.reference/shipped-projects.md`에서 유사 장르 참조)
2. 코딩 전략 수립 + 이전 전략 참조 (`.reference/coding-strategies/`)
3. 동적 스킬 생성 (`.claude/skills/game-architect/`, `game-coder/`, `game-tester/`)
4. 코드 작성 (architect → coder(fork) → tester(fork))
5. 빌드 확인 (`npm run build`)
6. 코딩 전략 박제 (`.reference/coding-strategies/{장르}_{날짜}.md`)

**기술 스택:** 기본 `Phaser 3 + TypeScript + Vite`. 프로토타입이 Canvas 2D면 유지 가능, 디렉터 지정 가능.

**동적 스킬(game-coder) 생성 시 필수 포함 규칙:**
- 아이템 10개 이상 → 텍스처 아틀라스 필수
- WebView → BackButtonManager + 이중 저장 (localStorage + IndexedDB)
- **Capacitor Android:**
  - `justify-content: flex-start` 필수
  - `getEnvelopCropLeft()` 크롭 헬퍼 + 물리 벽/UI/clamp 반영
  - `padding-top: env(safe-area-inset-top)` + `box-sizing: border-box`
  - MainActivity.java 시스템 UI 3요소
  - Container + Matter.js destroy 패턴 (physicsBody=null, prune 필수)
  - 상세: `.reference/lessons/oh-my-princess_final.md` 섹션 2~3, 10
- **멀티 플랫폼:**
  - 어댑터 패턴 격리 (`src/platform/`)
  - `VITE_PLATFORM` 빌드 분기 + `getAdapter().platform` 런타임 분기
  - Container.setScale() UI 크기 분기
  - Safe Area 3단계 fallback
  - 상세: `.reference/coding-strategies/platform-adapter-pattern_20260324.md`

**완료 보고:**
```
"Phase 3 자동 실행 완료:
- 기술 스택: [스택]
- 소스: src/ ([N]개 파일)
- 빌드: ✅ 통과

npm run dev로 플레이스홀더 상태의 게임을 확인해주세요.
괜찮으면 '컨펌'이라고 해주세요."
```

---

## Phase 4: 아트 에셋 생성

**반자동 실행:**
1. `/art-tool-builder` (fork) → Art Studio 생성
2. 코드 스캔 → `asset-manifest.json`
3. 프롬프트 작성 → **디렉터 컨펌**
4. 스타일 앵커 1개 생성 → **디렉터 컨펌**
5. 나머지 에셋 일괄 생성 + 후처리 (배경 제거 → 리사이즈)

**완료 보고:**
```
"Phase 4 완료:
- 생성: [N]개 에셋
- 후처리: 완료
- 비용: $X.XX (잔여 $Y.YY)

검수 후 '컨펌'이라고 해주세요."
```

---

## Phase 5: QA 및 빌드

**자동 실행:**

**5-1. 코드 리뷰 체크리스트:**
- 상태 초기화 일관성 (createState/resetState 동기화)
- 렌더 함수 읽기전용 (render에서 상태 변경 금지)
- Canvas save/restore 쌍
- 이벤트 리스너 정리
- 타이머/인터벌 클로저 안전성
- import 했으나 미사용 함수
- Container + Matter.js destroy 시 physicsBody=null
- 멀티 플랫폼 분기가 getAdapter() 경유하는지

**5-2. 콘솔 접근 불가 환경 디버그:**
Graphics/Text로 화면에 직접 렌더링. depth 999. 해결 후 제거.

**5-3. 에셋 바인딩:** asset-manifest 전체 bound 확인

**5-4. 최종 빌드:** `npm run build`

**5-5. 검증 코드 박제:** `.reference/verified_snippets/`

**완료 보고:**
```
"Phase 5 완료:
- 코드 리뷰: [N]건 수정
- 에셋 바인딩: [N]개 bound
- 빌드: ✅ 성공

배포로 넘어가려면 '컨펌'이라고 해주세요."
```

---

## Phase 6: 배포 및 운영

**6-1. 배포 타겟 결정** (디렉터에게 질문)

**자동 실행:**
1. 배포 설정 파일 생성
2. 빌드 + 후처리
3. 배포 실행
4. 운영 기능 (요청 시: 랭킹, Analytics, 공유 등)
5. 릴리즈 노트 생성 (`{플랫폼}/Build/RELEASE_NOTE.md`)

**릴리즈 노트 필수 항목:** 빌드 정보, 포함 기능, 플랫폼 특이사항, 알려진 이슈, 이전 버전과 차이

**최종 보고:**
```
"게임이 배포되었습니다!
- 소스: src/ ([N]개), 에셋: assets/ ([N]개)
- 비용: $X.XX / $Y.YY
- 배포 URL: [URL]

기술 자산 수확: '/game-harvest' 실행"
```

---

## 데이터 스키마

### asset-manifest.json
```json
{
  "art_direction": "docs/art-direction.md",
  "assets": [{
    "id": "에셋 키", "path": "assets/경로.png",
    "category": "character|monster|object|background|ui",
    "size": "WxH", "prompt": "프롬프트",
    "reference_image": "레퍼런스 경로",
    "status": "pending|generated|adopted|bound",
    "source_file": "소스 파일", "source_line": 0
  }]
}
```

### docs/usage.json
```json
{
  "settings": { "budget_limit_usd": 5.0, "unit_prices": {...} },
  "summary": { "total_spent_usd": 0.0 },
  "records": []
}
```

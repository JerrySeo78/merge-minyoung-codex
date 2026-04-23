---
name: btw
description: "Quickly records improvement ideas or repeating patterns during work. Use as '/btw automate this'. Collects ideas without breaking workflow."
user-invocable: true
---

# BTW — 피드백 루프

> BKIT btw 스킬 패턴 참고.
> 작업 중 떠오른 아이디어를 **한 줄로 기록**하고, 나중에 모아서 패턴을 분석한다.

## 사용법

```
/btw 이 패턴 자동화하면 좋겠다
/btw list
/btw analyze
```

## 액션

### `/btw {메시지}` — 아이디어 기록

메시지를 `docs/btw-suggestions.json`에 기록한다.
자동으로 카테고리를 감지한다:
- **skill-request**: "스킬", "자동화", "자동으로" 포함
- **bug-pattern**: "버그", "에러", "반복", "또" 포함
- **improvement**: "개선", "더 나은", "최적화" 포함
- **documentation**: "문서", "기록", "정리" 포함
- **general**: 위에 해당 없음

응답은 한 줄로 간결하게:
```
💡 기록됨 (#N, {카테고리}). 작업을 계속하세요.
```

### `/btw list` — 목록 조회

전체 아이디어 목록을 테이블로 보여준다:
```
| # | 카테고리 | 아이디어 | Phase | 날짜 |
```

### `/btw analyze` — 패턴 분석

누적된 아이디어에서 반복 패턴을 찾는다:
- 같은 카테고리 3개 이상 → "이 영역에서 반복적으로 개선 요청이 있습니다"
- 같은 키워드 2회 이상 → 클러스터링
- Phase별 분포 → "Phase 3에서 가장 많은 아이디어가 나왔습니다"

## 데이터 구조

`docs/btw-suggestions.json`:
```json
{
  "suggestions": [
    {
      "id": 1,
      "message": "에셋 리사이즈 자동화하면 좋겠다",
      "category": "skill-request",
      "phase": "art",
      "timestamp": "2026-03-30 10:30",
      "status": "pending"
    }
  ]
}
```

## 행동 규칙
- 기록 후 즉시 작업으로 돌아간다. 아이디어에 대해 토론하지 않는다.
- analyze는 3개 이상 아이디어가 쌓였을 때만 의미 있다.
- 디렉터가 `/btw list` 하면 간결하게 보여준다. 분석은 analyze에서만.

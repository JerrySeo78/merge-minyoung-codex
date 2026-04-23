---
name: cost-tracker
description: "Checks budget before Gemini API calls and records costs. Auto-used for image generation or external API calls."
user-invocable: false
---

# cost-tracker.md — 비용 추적 및 통제 스킬

> **Phase:** 전 Phase에서 활성
> **파일:** `docs/usage.json`

---

## 역할

모든 Gemini API 호출의 비용을 추적하고, 예산 한도를 물리적으로 통제한다.
다른 모든 스킬은 API 호출 전에 이 스킬의 예산 확인을 반드시 거쳐야 한다.

---

## usage.json 스키마

```json
{
  "settings": {
    "budget_limit_usd": 5.0,
    "unit_prices": {
      "flash_input_per_1k_tokens": 0.0,
      "flash_output_per_1k_tokens": 0.0,
      "image_gen_per_call": 0.0
    },
    "price_note": "프로젝트 초기화 시 웹 검색으로 실제 단가를 확인하여 업데이트할 것"
  },
  "summary": {
    "total_spent_usd": 0.0,
    "total_text_calls": 0,
    "total_image_calls": 0
  },
  "records": [
    {
      "timestamp": "ISO 8601",
      "type": "text|image",
      "skill": "호출한 스킬 이름",
      "tokens_in": 0,
      "tokens_out": 0,
      "image_count": 0,
      "cost_usd": 0.0,
      "description": "호출 목적 한 줄 요약"
    }
  ]
}
```

---

## 초기화 절차 (프로젝트 시작 시 1회)

1. 웹 검색으로 현재 Gemini API 과금 체계를 확인한다.
   - 검색어: "Gemini API pricing 2026" 또는 "Gemini Flash image generation cost"
2. `unit_prices`를 실제 단가로 업데이트한다.
3. `price_note`를 "Updated on [날짜], source: [URL]"로 변경한다.
4. 사용자에게 예산 한도(`budget_limit_usd`)를 확인한다.

---

## API 호출 전 예산 확인 (Guard 함수)

모든 Gemini API 호출 전에 다음을 수행한다:

```
1. usage.json 로드
2. remaining = settings.budget_limit_usd - summary.total_spent_usd
3. estimated_cost = 예상 비용 계산

if (summary.total_spent_usd >= settings.budget_limit_usd):
    → HARD BLOCK
    → "예산이 소진되었습니다. ($X.XX / $Y.YY)"
    → "예산을 늘리려면 usage.json의 budget_limit_usd를 수정해주세요."
    → API 호출하지 않는다.

elif (summary.total_spent_usd >= settings.budget_limit_usd * 0.9):
    → WARNING
    → "예산의 90%를 사용했습니다. ($X.XX / $Y.YY, 잔여 $Z.ZZ)"
    → 사용자에게 계속 진행할지 확인한다.
    → 사용자 승인 시에만 API 호출.

else:
    → PASS
    → API 호출 진행.
```

---

## API 호출 후 비용 기록 (Record 함수)

API 호출 완료 후 반드시 다음을 수행한다:

```
1. 호출 결과에서 토큰 수 추출 (response.usage_metadata)
2. 비용 계산:
   - 텍스트: (tokens_in / 1000 * flash_input_per_1k) + (tokens_out / 1000 * flash_output_per_1k)
   - 이미지: image_count * image_gen_per_call
3. records 배열에 새 레코드 추가
4. summary.total_spent_usd 업데이트
5. summary.total_text_calls 또는 total_image_calls 업데이트
6. usage.json 파일 저장
```

---

## 비용 보고 (Report 함수)

사용자가 비용을 물으면, 또는 Phase 완료 시 자동으로 보고한다:

```
📊 비용 현황
━━━━━━━━━━━━━━━━━━━━
총 사용: $X.XX / $Y.YY (ZZ%)
텍스트 호출: N회
이미지 생성: N회
잔여 예산: $Z.ZZ
━━━━━━━━━━━━━━━━━━━━
```

---

## 주의사항

- `usage.json`은 **Write Gateway 없이 직접 수정해도 된다.** 이 파일은 추적 용도이므로.
- API 응답에 토큰 수가 없는 경우 프롬프트 길이로 추정한다 (1 토큰 ≈ 4 영문자).
- 이미지 생성 비용은 호출 횟수 기준이다 (성공/실패 무관하게 API 호출 자체가 과금).
- 재시도 시 각 시도마다 비용이 발생할 수 있으므로, 재시도 횟수도 고려한다.
- 예산 리셋: 사용자가 `budget_limit_usd`를 수정하거나, `summary.total_spent_usd`를 0으로 리셋할 수 있다.

---
name: game-validator
description: "Validates game plan for contradictions, risks, and balance issues. Used in Phase 2 or auto-triggered for plan validation."
---

# game-validator — Game Plan Validation Skill

> **Phase:** 2
> **Input:** `docs/game-plan.md`, `docs/art-direction.md`
> **Output:** `docs/validation-report.md`

---

## Role

Read the confirmed plan and detect contradictions, risks, and balance issues from a game design perspective.
Provide evidence and suggestions so the director can decide whether to revise or proceed.

---

## Validation Process

### Step 1: Load Plan

Read `docs/game-plan.md` and `docs/art-direction.md` in full.

### Step 2: Run 5 Validation Checks

#### Check 1: Core Loop Completeness
- Does the loop cycle? (No dead ends?)
- Clear path: player action → reward → growth?
- Is there an answer to "why keep playing?"

**Red flags:** Reward doesn't connect to growth; growth doesn't motivate next action; loop cycle too long/short.

#### Check 2: Economy Balance
- Every currency has source (earn) and sink (spend)?
- No infinite inflation possible?
- Pacing bottlenecks are intentional?

**Red flags:** Currency with no sink; earn always > spend; no premium/free exchange rate.

#### Check 3: System Dependencies
- System A output connects to System B input?
- No orphan systems?
- Circular dependencies are intentional?

**Red flags:** Isolated system; duplicate functionality; unclear data flow between systems.

#### Check 4: Scope Feasibility
- MVP achievable in 2 weeks (1-person + AI)?
- System count reasonable? (3-5 recommended for MVP)
- Content volume realistic?

**Red flags:** 7+ systems; 10+ screens; realtime multiplayer required; server-side logic needed.

#### Check 5: Art Direction Consistency
- Art style matches game genre/mood?
- Asset sizes match resolution?
- Asset count realistic? (consider Gemini generation cost)

**Red flags:** 50+ expected assets (cost warning); excessive sprite animation frames; style-tone mismatch.

### Step 3: Write Validation Report

Write `docs/validation-report.md`:

```markdown
# Validation Report: [Game Title]

## Summary
- Checks: 5
- Pass: [N]
- Warn: [N] (by severity)
- Block: [N] (cannot proceed)

## Details

### [Check Name]
- **Verdict:** Pass / Warn / Block
- **Severity:** low / medium / high / critical
- **Finding:** Description of issue
- **Evidence:** Why this is a problem
- **Suggestion:** How to fix

## Recommended Action
1. [If blocked] Revise plan and re-validate
2. [If warn only] Acknowledge and proceed with [specific caution]
3. [If all pass] Ready for coding phase
```

---

## Severity Scale

| Severity | Meaning | Action |
|----------|---------|--------|
| **critical** | Game cannot function | Return to Phase 1, revise plan |
| **high** | Fun seriously compromised | Revision strongly recommended |
| **medium** | Improvable but can proceed | Inform director |
| **low** | Minor improvement | Note only |

---

## Rules

- Frame as "this risk exists" not "this is wrong."
- Respect intentional design decisions. Ask "is this intentional?" to confirm.
- Every warning MUST include a concrete fix suggestion.
- No excessive warnings. Report real issues only.

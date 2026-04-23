#!/usr/bin/env node

/**
 * on-stop-failure.cjs (v1)
 * StopFailure Hook — 비정상 세션 종료 시 상태 긴급 보존
 *
 * 역할:
 * 1. 에러 분류 (rate_limit, auth, server, timeout, context_overflow)
 * 2. phase-state.json 긴급 백업
 * 3. 복구 가이드 메시지 출력
 *
 * BKIT stop-failure-handler.js 패턴 참고
 */

const fs = require('fs');
const path = require('path');

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const workLogPath = path.join(projectDir, 'docs', 'work-log.md');

let inputData = '';

process.stdin.on('data', (chunk) => { inputData += chunk; });

process.stdin.on('end', () => {
  try {
    if (!fs.existsSync(workLogPath)) {
      process.exit(0);
      return;
    }

    const hookInput = JSON.parse(inputData);
    const error = hookInput.error || hookInput.message || '';
    const errorStr = typeof error === 'string' ? error : JSON.stringify(error);

    // 에러 분류
    const classification = classifyError(errorStr);

    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const timestamp = kst.toISOString().replace('T', ' ').substring(0, 16);
    const yyyymmdd = kst.toISOString().substring(0, 10).replace(/-/g, '');

    // 1. phase-state.json 긴급 백업
    const phaseStatePath = path.join(projectDir, 'docs', 'phase-state.json');
    if (fs.existsSync(phaseStatePath)) {
      const backupDir = path.join(projectDir, 'docs', 'snapshots');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      const backupPath = path.join(backupDir, `emergency-${yyyymmdd}.json`);
      try {
        const state = JSON.parse(fs.readFileSync(phaseStatePath, 'utf-8'));
        state._emergency = {
          timestamp,
          errorType: classification.type,
          errorMessage: errorStr.substring(0, 200),
        };
        fs.writeFileSync(backupPath, JSON.stringify(state, null, 2), 'utf-8');
      } catch { /* skip */ }
    }

    // 2. daily log에 에러 기록
    const logsDir = path.join(projectDir, 'docs', 'logs');
    if (fs.existsSync(logsDir)) {
      const dailyLogPath = path.join(logsDir, `${yyyymmdd}.md`);
      const row = `| ${timestamp} | ⚠️ 비정상종료 | ${classification.type}: ${classification.summary} |\n`;
      if (fs.existsSync(dailyLogPath)) {
        fs.appendFileSync(dailyLogPath, row, 'utf-8');
      } else {
        const header = `# 작업 로그 ${yyyymmdd}\n\n| 시간 | 구분 | 내용 |\n|------|------|------|\n`;
        fs.writeFileSync(dailyLogPath, header + row, 'utf-8');
      }
    }

    // 3. 에러 로그 누적 (최근 50건)
    const errorLogPath = path.join(projectDir, 'docs', 'error-log.json');
    let errorLog = { errors: [] };
    if (fs.existsSync(errorLogPath)) {
      try { errorLog = JSON.parse(fs.readFileSync(errorLogPath, 'utf-8')); } catch { /* reset */ }
    }
    errorLog.errors.push({
      timestamp,
      type: classification.type,
      summary: classification.summary,
      raw: errorStr.substring(0, 500),
    });
    if (errorLog.errors.length > 50) {
      errorLog.errors = errorLog.errors.slice(-50);
    }
    fs.writeFileSync(errorLogPath, JSON.stringify(errorLog, null, 2), 'utf-8');

  } catch (err) {
    process.stderr.write('[Hook] on-stop-failure error: ' + err.message + '\n');
  }

  process.exit(0);
});

/**
 * 에러 문자열에서 유형 분류 + 복구 가이드
 */
function classifyError(errorStr) {
  const lower = errorStr.toLowerCase();

  if (lower.includes('rate') && lower.includes('limit') || lower.includes('429')) {
    return { type: 'rate_limit', summary: 'API 속도 제한 — 30~60초 후 재시도' };
  }
  if (lower.includes('auth') || lower.includes('401') || lower.includes('api key')) {
    return { type: 'auth_failure', summary: 'API 인증 실패 — API 키 확인 필요' };
  }
  if (lower.includes('500') || lower.includes('internal server')) {
    return { type: 'server_error', summary: 'API 서버 오류 — 1~2분 후 재시도' };
  }
  if (lower.includes('overload') || lower.includes('529') || lower.includes('capacity')) {
    return { type: 'overloaded', summary: 'API 과부하 — 2~5분 후 재시도' };
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return { type: 'timeout', summary: '타임아웃 — 작업 범위를 줄여서 재시도' };
  }
  if (lower.includes('context') && (lower.includes('overflow') || lower.includes('too long') || lower.includes('limit'))) {
    return { type: 'context_overflow', summary: '컨텍스트 초과 — /compact 후 재시도' };
  }

  return { type: 'unknown', summary: errorStr.substring(0, 100) };
}

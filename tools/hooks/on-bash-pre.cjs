#!/usr/bin/env node

/**
 * on-bash-pre.cjs (v1)
 * PreToolUse Hook (matcher: Bash) — Bash 실행 전 위험 감지
 *
 * 역할:
 * 1. destructive-detector로 위험 명령 감지
 * 2. deny → 차단, warn → 경고 메시지 출력
 *
 * BKIT unified-bash-pre.js 패턴 참고
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
      // 게임 프로젝트가 아니면 무시
      console.log(JSON.stringify({ decision: 'allow' }));
      process.exit(0);
      return;
    }

    const hookInput = JSON.parse(inputData);
    const command = hookInput.tool_input?.command || '';

    // destructive-detector 로드
    let detector;
    try {
      detector = require(path.join(projectDir, 'tools', 'lib', 'destructive-detector.js'));
    } catch {
      // detector 없으면 통과 (v3 프로젝트 호환)
      console.log(JSON.stringify({ decision: 'allow' }));
      process.exit(0);
      return;
    }

    const result = detector.detect(command);

    if (result.action === 'deny') {
      const message = detector.formatMessage(result);
      // daily log에 차단 기록
      logEvent(projectDir, `차단: ${command.substring(0, 80)}`);
      console.log(JSON.stringify({
        decision: 'block',
        reason: message,
      }));
    } else if (result.action === 'warn') {
      const message = detector.formatMessage(result);
      // 경고만 하고 허용
      logEvent(projectDir, `경고: ${command.substring(0, 80)}`);
      console.log(JSON.stringify({
        decision: 'allow',
        reason: message,
      }));
    } else {
      console.log(JSON.stringify({ decision: 'allow' }));
    }

  } catch (err) {
    process.stderr.write('[Hook] on-bash-pre error: ' + err.message + '\n');
    console.log(JSON.stringify({ decision: 'allow' }));
  }

  process.exit(0);
});

function logEvent(projectDir, message) {
  try {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const timestamp = kst.toISOString().replace('T', ' ').substring(0, 16);
    const yyyymmdd = kst.toISOString().substring(0, 10).replace(/-/g, '');
    const logsDir = path.join(projectDir, 'docs', 'logs');
    if (!fs.existsSync(logsDir)) return;
    const dailyLogPath = path.join(logsDir, `${yyyymmdd}.md`);
    const row = `| ${timestamp} | 🛡️ 가드레일 | ${message} |\n`;
    if (fs.existsSync(dailyLogPath)) {
      fs.appendFileSync(dailyLogPath, row, 'utf-8');
    }
  } catch { /* ignore */ }
}

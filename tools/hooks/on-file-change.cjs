#!/usr/bin/env node

/**
 * on-file-change.js (v3)
 * PostToolUse Hook (matcher: Write|Edit) — 파일 변경 후 자동 실행
 *
 * 역할:
 * 1. 변경된 파일 정보를 docs/logs/YYYYMMDD.md (일별 파일)에 기록
 * 2. work-log.md는 건드리지 않음 — "현재 상태" + "Phase 이력"만 유지
 *
 * 변경 이력:
 * v1 → v2: 버전 태그 정리
 * v2 → v3: work-log.md 테이블 대신 docs/logs/YYYYMMDD.md에 기록 (컨텍스트 부하 방지)
 */

const fs = require('fs');
const path = require('path');

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const workLogPath = path.join(projectDir, 'docs', 'work-log.md');

let inputData = '';

process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
    // work-log.md가 없으면 게임 프로젝트가 아님 → 무시
    if (!fs.existsSync(workLogPath)) {
      process.exit(0);
      return;
    }

    const hookInput = JSON.parse(inputData);
    const toolName = hookInput.tool_name || 'unknown';
    const filePath = hookInput.tool_input?.file_path || '';

    // 무시할 파일 (Hook 관련, 설정 파일)
    const ignorePaths = ['docs/work-log.md', 'tools/hooks/', '.claude/'];
    if (ignorePaths.some(p => filePath.includes(p))) {
      process.exit(0);
      return;
    }

    // 타임스탬프 (KST)
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const yyyymmdd = kst.toISOString().substring(0, 10).replace(/-/g, '');
    const timestamp = kst.toISOString().replace('T', ' ').substring(0, 16);

    // 변경 유형 판별
    const action = toolName === 'Write' ? '생성/덮어쓰기' : '부분 수정';

    // 짧은 파일 경로 (프로젝트 루트 기준)
    const shortPath = filePath.replace(projectDir, '').replace(/^[/\\]/, '');

    // docs/logs/ 폴더 확인
    const logsDir = path.join(projectDir, 'docs', 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // 일별 로그 파일에 기록
    const dailyLogPath = path.join(logsDir, `${yyyymmdd}.md`);
    const newRow = `| ${timestamp} | ${action} | \`${shortPath}\` |\n`;

    if (!fs.existsSync(dailyLogPath)) {
      const header = `# 작업 로그 ${yyyymmdd}\n\n| 시간 | 구분 | 파일 |\n|------|------|------|\n`;
      fs.writeFileSync(dailyLogPath, header + newRow, 'utf-8');
    } else {
      fs.appendFileSync(dailyLogPath, newRow, 'utf-8');
    }

    // ===== Loop Breaker (v4) =====
    // 같은 파일이 5분 이내에 5번 이상 수정되면 경고
    try {
      const trackerPath = path.join(projectDir, 'docs', 'loop-tracker.json');
      const THRESHOLD = 5;
      const WINDOW_MS = 5 * 60 * 1000;

      let tracker = { edits: [] };
      if (fs.existsSync(trackerPath)) {
        tracker = JSON.parse(fs.readFileSync(trackerPath, 'utf-8'));
      }

      const nowMs = now.getTime();
      // 오래된 항목 정리
      tracker.edits = (tracker.edits || []).filter(e => (nowMs - e.time) < WINDOW_MS);
      // 현재 편집 추가
      tracker.edits.push({ file: shortPath, time: nowMs });

      // 같은 파일 수정 횟수 체크
      const sameFileCount = tracker.edits.filter(e => e.file === shortPath).length;
      if (sameFileCount >= THRESHOLD) {
        tracker.warning = `${shortPath}이(가) ${THRESHOLD}분 내에 ${sameFileCount}번 수정됨 — 반복 수정 루프 가능성`;
        // daily log에 경고 기록
        const warnRow = `| ${timestamp} | ⚠️ 루프감지 | \`${shortPath}\` ${sameFileCount}회 반복 수정 |\n`;
        fs.appendFileSync(dailyLogPath, warnRow, 'utf-8');
      } else {
        delete tracker.warning;
      }

      fs.writeFileSync(trackerPath, JSON.stringify(tracker, null, 2), 'utf-8');
    } catch {
      // loop tracker 실패는 무시
    }

    // ===== Post-Write 가이드 (v4) =====
    // src/ 파일 수정 + game-plan.md 존재 → Gap Analysis 제안
    try {
      const isSourceFile = shortPath.startsWith('src/') || shortPath.startsWith('src\\');
      const gamePlanExists = fs.existsSync(path.join(projectDir, 'docs', 'game-plan.md'));

      if (isSourceFile && gamePlanExists) {
        const guidePath = path.join(projectDir, 'docs', 'post-write-guide.json');
        let guide = { lastSuggested: null, sourceEdits: 0 };
        if (fs.existsSync(guidePath)) {
          try { guide = JSON.parse(fs.readFileSync(guidePath, 'utf-8')); } catch { /* reset */ }
        }

        guide.sourceEdits = (guide.sourceEdits || 0) + 1;

        // 소스 파일 10회 수정마다 Gap Analysis 제안 (너무 자주 제안하지 않음)
        if (guide.sourceEdits % 10 === 0) {
          guide.lastSuggested = timestamp;
          const suggestRow = `| ${timestamp} | 💡 제안 | src/ ${guide.sourceEdits}회 수정 — 칼에게 Gap Analysis 요청 권장 |\n`;
          if (fs.existsSync(dailyLogPath)) {
            fs.appendFileSync(dailyLogPath, suggestRow, 'utf-8');
          }
        }

        fs.writeFileSync(guidePath, JSON.stringify(guide, null, 2), 'utf-8');
      }
    } catch {
      // post-write guide 실패는 무시
    }

  } catch (err) {
    // Hook 에러는 조용히 처리
    process.stderr.write('[Hook] on-file-change error: ' + err.message + '\n');
  }

  process.exit(0);
});

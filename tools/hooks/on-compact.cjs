#!/usr/bin/env node

/**
 * on-compact.cjs (v1)
 * PreCompact Hook — 컨텍스트 컴팩션 전 상태 보존
 *
 * 역할:
 * 1. phase-state.json 스냅샷 저장
 * 2. work-log.md 현재 상태 백업
 * 3. 최근 10개 스냅샷만 유지
 *
 * BKIT context-compaction.js 패턴 참고
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

    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const timestamp = kst.toISOString().replace(/[:.]/g, '-').substring(0, 19);

    // 스냅샷 디렉토리
    const snapshotDir = path.join(projectDir, 'docs', 'snapshots');
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }

    const snapshot = {};

    // 1. phase-state.json 보존
    const phaseStatePath = path.join(projectDir, 'docs', 'phase-state.json');
    if (fs.existsSync(phaseStatePath)) {
      try {
        snapshot.phaseState = JSON.parse(fs.readFileSync(phaseStatePath, 'utf-8'));
      } catch { /* skip */ }
    }

    // 2. work-log.md 현재 상태 추출 (첫 20줄)
    try {
      const workLog = fs.readFileSync(workLogPath, 'utf-8');
      const lines = workLog.split('\n').slice(0, 20);
      snapshot.workLogHead = lines.join('\n');
    } catch { /* skip */ }

    // 3. agent-status.json 보존
    const agentStatusPath = path.join(projectDir, 'docs', 'agent-status.json');
    if (fs.existsSync(agentStatusPath)) {
      try {
        snapshot.agentStatus = JSON.parse(fs.readFileSync(agentStatusPath, 'utf-8'));
      } catch { /* skip */ }
    }

    // 스냅샷 저장
    snapshot.timestamp = kst.toISOString().replace('T', ' ').substring(0, 16);
    snapshot.reason = 'pre-compact';

    const snapshotPath = path.join(snapshotDir, `snapshot-${timestamp}.json`);
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');

    // 최근 10개만 유지
    const snapshots = fs.readdirSync(snapshotDir)
      .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
      .sort();
    if (snapshots.length > 10) {
      const toDelete = snapshots.slice(0, snapshots.length - 10);
      for (const f of toDelete) {
        fs.unlinkSync(path.join(snapshotDir, f));
      }
    }

    // daily log에 기록
    const yyyymmdd = kst.toISOString().substring(0, 10).replace(/-/g, '');
    const logsDir = path.join(projectDir, 'docs', 'logs');
    if (fs.existsSync(logsDir)) {
      const dailyLogPath = path.join(logsDir, `${yyyymmdd}.md`);
      const row = `| ${snapshot.timestamp} | 컴팩션 | 상태 스냅샷 저장 (${snapshot.phaseState?.currentPhase || 'unknown'}) |\n`;
      if (fs.existsSync(dailyLogPath)) {
        fs.appendFileSync(dailyLogPath, row, 'utf-8');
      }
    }

  } catch (err) {
    process.stderr.write('[Hook] on-compact error: ' + err.message + '\n');
  }

  process.exit(0);
});

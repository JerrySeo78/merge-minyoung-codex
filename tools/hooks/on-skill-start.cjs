#!/usr/bin/env node

/**
 * on-skill-start.cjs
 * PreToolUse Hook (matcher: Skill|Agent) — 스킬/에이전트 호출 시 자동 실행
 *
 * 역할:
 * 1. 호출된 스킬/에이전트를 agent-status.json 배열에 push
 * 2. daily log에 에이전트 시작 기록
 */

const fs = require('fs');
const path = require('path');

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const statusPath = path.join(projectDir, 'docs', 'agent-status.json');
const logsDir = path.join(projectDir, 'docs', 'logs');

let inputData = '';

process.stdin.on('data', (chunk) => { inputData += chunk; });

process.stdin.on('end', () => {
  try {
    if (!fs.existsSync(path.join(projectDir, 'docs'))) {
      process.exit(0);
      return;
    }

    const hookInput = JSON.parse(inputData);
    const toolName = hookInput.tool_name || '';
    const toolInput = hookInput.tool_input || {};

    // 팀원 이름 목록 (매칭용)
    const teamMembers = ['wilson', 'jamie', 'carl', 'rex', 'kim', 'bashy', 'laura', 'ronin', 'noel', 'harry', 'kay', 'will', 'kenny'];

    let agentName = '(unknown)';
    let displayName = ''; // daily log용 (설명 포함)
    if (toolName === 'Skill') {
      agentName = toolInput.skill || toolInput.name || '(unknown skill)';
      displayName = agentName;
    } else if (toolName === 'Agent') {
      const desc = toolInput.description || '';
      const prompt = toolInput.prompt || '';
      // 프롬프트/설명에서 팀원 이름 추출 시도
      const combined = (desc + ' ' + prompt).toLowerCase();
      const matched = teamMembers.find(m => combined.includes(m));
      agentName = matched || desc || toolInput.subagent_type || '(agent)';
      displayName = matched ? `${matched} — ${desc}` : (desc || '(agent)');
    } else {
      agentName = toolInput.skill || toolInput.name || toolName || '(unknown)';
      displayName = agentName;
    }

    // KST 타임스탬프
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const timestamp = kst.toISOString().replace('T', ' ').substring(0, 16);
    const yyyymmdd = kst.toISOString().substring(0, 10).replace(/-/g, '');

    // agent-status.json — 배열에 push
    let data = { agents: [] };
    if (fs.existsSync(statusPath)) {
      try {
        const prev = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
        if (Array.isArray(prev.agents)) {
          data = prev;
        }
      } catch { }
    }

    data.agents.push({
      name: agentName,
      type: toolName === 'Agent' ? 'agent' : 'skill',
      started: timestamp,
    });

    fs.writeFileSync(statusPath, JSON.stringify(data, null, 2), 'utf-8');

    // daily log에 기록
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    const dailyLogPath = path.join(logsDir, `${yyyymmdd}.md`);
    const row = `| ${timestamp} | 에이전트 시작 | ${displayName} |\n`;

    if (!fs.existsSync(dailyLogPath)) {
      const header = `# 작업 로그 ${yyyymmdd}\n\n| 시간 | 구분 | 내용 |\n|------|------|------|\n`;
      fs.writeFileSync(dailyLogPath, header + row, 'utf-8');
    } else {
      fs.appendFileSync(dailyLogPath, row, 'utf-8');
    }

  } catch (err) {
    process.stderr.write('[Hook] on-skill-start error: ' + err.message + '\n');
  }

  process.exit(0);
});

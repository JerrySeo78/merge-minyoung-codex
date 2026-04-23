#!/usr/bin/env node

/**
 * on-stop.js (v5)
 * Stop Hook — Claude 응답 완료 시 자동 실행
 *
 * 역할:
 * 1. last_assistant_message를 Gemini Flash-Lite에 보내 한 줄 요약을 생성한다
 * 2. docs/work-log.md "현재 상태" 섹션을 갱신한다
 * 3. docs/logs/YYYYMMDD.md에 세션 요약을 기록한다
 *
 * 변경 이력:
 * v1 → v2: 버전 태그 정리
 * v2 → v3: transcript 파싱 시도 (실패)
 * v3 → v4: hookInput.last_assistant_message 직접 사용
 * v4 → v5: Gemini Flash-Lite API 호출로 AI 요약 생성
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const workLogPath = path.join(projectDir, 'docs', 'work-log.md');
const logsDir = path.join(projectDir, 'docs', 'logs');

// Google API Key: 환경변수에서 읽기 (시스템 환경변수 또는 .env.local)
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || loadEnvLocal();

function loadEnvLocal() {
  try {
    const envPath = path.join(projectDir, '.env.local');
    if (!fs.existsSync(envPath)) return '';
    const content = fs.readFileSync(envPath, 'utf-8');
    const match = content.match(/GOOGLE_API_KEY=(.+)/);
    return match ? match[1].trim() : '';
  } catch { return ''; }
}

let inputData = '';

process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', async () => {
  try {
    if (!fs.existsSync(workLogPath)) {
      process.exit(0);
      return;
    }

    const hookInput = JSON.parse(inputData);
    const lastMessage = hookInput.last_assistant_message || '';

    // ===== 세션 요약 생성 =====
    let summary = '';

    if (lastMessage && GOOGLE_API_KEY) {
      const result = await summarizeWithGemini(lastMessage);
      summary = result.text;
      if (result.inputTokens || result.outputTokens) {
        recordSummaryCost(result.inputTokens, result.outputTokens);
      }
    }

    // Gemini 실패 시 폴백: 규칙 기반 추출
    if (!summary) {
      summary = extractSummaryFallback(lastMessage);
    }

    if (!summary) {
      summary = '(세션 종료)';
    }

    // ===== 타임스탬프 (KST) =====
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const timestamp = kst.toISOString().replace('T', ' ').substring(0, 16);
    const yyyymmdd = kst.toISOString().substring(0, 10).replace(/-/g, '');

    // ===== 1. work-log.md "현재 상태" 갱신 =====
    let content = fs.readFileSync(workLogPath, 'utf-8');

    content = content.replace(
      /- 마지막 작업:\s*.*/,
      `- 마지막 작업: ${summary} (${timestamp})`
    );

    if (content.includes('- 마지막 세션:')) {
      content = content.replace(
        /- 마지막 세션:\s*.*/,
        `- 마지막 세션: ${timestamp}`
      );
    } else {
      content = content.replace(
        /(- 디렉터 마지막 지시:\s*.*)/,
        `$1\n- 마지막 세션: ${timestamp}`
      );
    }

    fs.writeFileSync(workLogPath, content, 'utf-8');

    // ===== 2. daily log에 세션 요약 기록 =====
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const dailyLogPath = path.join(logsDir, `${yyyymmdd}.md`);
    const sessionRow = `| ${timestamp} | 세션 | ${summary} |\n`;

    if (!fs.existsSync(dailyLogPath)) {
      const header = `# 작업 로그 ${yyyymmdd}\n\n| 시간 | 구분 | 내용 |\n|------|------|------|\n`;
      fs.writeFileSync(dailyLogPath, header + sessionRow, 'utf-8');
    } else {
      fs.appendFileSync(dailyLogPath, sessionRow, 'utf-8');
    }

    // ===== 3. State Machine 상태 보존 (v4) =====
    try {
      const smPath = path.join(projectDir, 'tools', 'lib', 'state-machine.js');
      if (fs.existsSync(smPath)) {
        const sm = require(smPath);
        const phase = sm.getCurrentPhase(projectDir);
        // phase-state.json이 있으면 lastSessionTime 기록
        const state = sm.loadState(projectDir);
        if (state.currentPhase !== 'idle') {
          state.lastSessionTime = timestamp;
          state.lastSessionSummary = summary.substring(0, 100);
          sm.saveState(projectDir, state);
        }
      }
    } catch {
      // state-machine 연동 실패는 무시 (v3 프로젝트 호환)
    }

  } catch (err) {
    process.stderr.write('[Hook] on-stop error: ' + err.message + '\n');
  }

  process.exit(0);
});

/**
 * Gemini Flash-Lite API를 호출하여 대화 내용을 한 줄로 요약
 */
function summarizeWithGemini(message) {
  return new Promise((resolve) => {
    // 메시지가 너무 길면 앞뒤만 사용 (비용 절감)
    let input = message;
    if (input.length > 2000) {
      input = input.substring(0, 1000) + '\n...(중략)...\n' + input.substring(input.length - 1000);
    }

    const model = 'gemini-2.5-flash-lite';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`;
    const parsed = new URL(url);

    const body = JSON.stringify({
      contents: [{
        parts: [{
          text: `다음은 AI 어시스턴트의 응답입니다. 이 응답에서 수행한 작업을 한국어 한 줄(50자 이내)로 요약해주세요. 인사말이나 설명은 빼고 핵심 작업만 적어주세요. 마크다운 없이 순수 텍스트로만 답변하세요.\n\n${input}`
        }]
      }],
      generationConfig: {
        maxOutputTokens: 60,
        temperature: 0.1,
      }
    });

    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const oneLine = text.split('\n')[0].replace(/[*#`]/g, '').trim().substring(0, 150);
          const usage = json.usageMetadata || {};
          resolve({
            text: oneLine,
            inputTokens: usage.promptTokenCount || 0,
            outputTokens: usage.candidatesTokenCount || 0,
          });
        } catch {
          resolve('');
        }
      });
    });

    req.on('error', () => resolve({ text: '', inputTokens: 0, outputTokens: 0 }));
    req.on('timeout', () => { req.destroy(); resolve({ text: '', inputTokens: 0, outputTokens: 0 }); });
    req.write(body);
    req.end();
  });
}

/**
 * Gemini 요약 비용을 docs/summary-cost.json에 기록
 */
function recordSummaryCost(inputTokens, outputTokens) {
  try {
    const costPath = path.join(projectDir, 'docs', 'summary-cost.json');
    let data = { total_calls: 0, total_input_tokens: 0, total_output_tokens: 0, total_cost_usd: 0, today: {}, history: [] };

    if (fs.existsSync(costPath)) {
      data = JSON.parse(fs.readFileSync(costPath, 'utf-8'));
    }

    // Flash-Lite 단가 (2026-03 기준)
    const INPUT_PRICE = 0.075 / 1_000_000;  // $0.075 per 1M tokens
    const OUTPUT_PRICE = 0.30 / 1_000_000;  // $0.30 per 1M tokens
    const callCost = (inputTokens * INPUT_PRICE) + (outputTokens * OUTPUT_PRICE);

    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const todayKey = kst.toISOString().substring(0, 10);

    data.total_calls += 1;
    data.total_input_tokens += inputTokens;
    data.total_output_tokens += outputTokens;
    data.total_cost_usd = Math.round((data.total_cost_usd + callCost) * 1000000) / 1000000;

    if (!data.today || data.today.date !== todayKey) {
      if (data.today && data.today.date) {
        data.history.push({ ...data.today });
      }
      data.today = { date: todayKey, calls: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0 };
    }
    data.today.calls += 1;
    data.today.input_tokens += inputTokens;
    data.today.output_tokens += outputTokens;
    data.today.cost_usd = Math.round((data.today.cost_usd + callCost) * 1000000) / 1000000;

    fs.writeFileSync(costPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // 비용 기록 실패는 무시
  }
}

/**
 * Gemini 실패 시 폴백: 규칙 기반 요약 추출
 */
function extractSummaryFallback(message) {
  if (!message) return '';
  const lines = message.split('\n');

  // 마크다운 헤딩
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^#{1,3}\s+.{5,}/.test(trimmed)) {
      return trimmed.replace(/^#+\s*/, '').substring(0, 150);
    }
  }

  // 작업 키워드 포함 줄
  const keywords = ['완료', '생성', '수정', '추가', '삭제', '구현', '설정', '배포', '해결', '분석', 'Phase', '컨펌'];
  for (const line of lines) {
    const trimmed = line.replace(/^[#*\->\s|]+/, '').trim();
    if (trimmed.length > 10 && keywords.some(k => trimmed.includes(k))) {
      return trimmed.substring(0, 150);
    }
  }

  // 인사말 건너뛴 첫 실질적 줄
  const skipPatterns = [
    /^(네|맞습니다|좋습니다|알겠습니다|확인|이해|감사|물론|당연)/,
    /^(yes|sure|ok|right|got it|understood)/i,
  ];
  for (const line of lines) {
    const trimmed = line.replace(/^[#*\->\s|]+/, '').trim();
    if (trimmed.length > 15 && !skipPatterns.some(p => p.test(trimmed))) {
      return trimmed.substring(0, 150);
    }
  }

  return '';
}

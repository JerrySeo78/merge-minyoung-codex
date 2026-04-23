#!/usr/bin/env node

/**
 * on-session-start.js (v2)
 * SessionStart Hook — 세션 시작 시 자동 실행
 * 
 * 역할:
 * 1. docs/work-log.md의 "현재 상태" 섹션을 읽어서 컨텍스트에 주입
 * 2. 파이프라인 진행 중이면 Phase 안내
 * 3. Phase 완료 후면 작업 유형별 규칙 안내
 * 
 * 변경 이력:
 * v1 → v2: Production/Patch 모드 판별 제거, 요청 유형별 규칙 체계로 전환
 */

const fs = require('fs');
const path = require('path');

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const workLogPath = path.join(projectDir, 'docs', 'work-log.md');

let output = '';

try {
  if (fs.existsSync(workLogPath)) {
    const content = fs.readFileSync(workLogPath, 'utf-8');

    // "현재 상태" 섹션 추출 (## 현재 상태 ~ 다음 ## 전까지)
    const statusMatch = content.match(/## 현재 상태\s*\n([\s\S]*?)(?=\n## |$)/);

    if (statusMatch) {
      const statusSection = statusMatch[1].trim();
      output += '📋 프로젝트 현재 상태:\n';
      output += statusSection + '\n';

      // Phase 상태 판별
      const phaseMatch = statusSection.match(/현재 Phase:\s*(.+)/);
      const currentPhase = phaseMatch ? phaseMatch[1].trim() : '';

      if (currentPhase === '미시작' || currentPhase === '') {
        // 초기 상태
        output += '\n🆕 프로젝트가 초기화 상태입니다. Phase 1부터 시작하세요.\n';

      } else if (currentPhase === '완료' || currentPhase.includes('완료')) {
        // 파이프라인 완료 → 작업 유형별 규칙 안내
        output += '\n✅ 파이프라인 완료 상태입니다. 요청 유형별 규칙을 따르세요:\n';
        output += '- Patch (코드 부분 수정): 해당 파일만 Edit, 다른 파일 건드리지 않기\n';
        output += '- Expand (신규 기능 추가): 범위 정리 → 디렉터 컨펌 → 구현\n';
        output += '- Art (이미지 생성/재생성): art-worker 또는 Art Studio 경유 필수\n';
        output += '- 복합: 각 유형의 규칙을 그대로 따름\n';
        output += '자세한 규칙은 CLAUDE.md 규칙 0번을 참조하세요.\n';

      } else {
        // Phase 진행 중
        output += '\n🏭 파이프라인 진행 중입니다.\n';
        output += '- CLAUDE.md의 Phase 순서를 따르세요.\n';
        output += '- 디렉터 컨펌 없이 다음 Phase로 넘어가지 마세요.\n';
      }
    } else {
      output += '⚠️ docs/work-log.md에 "현재 상태" 섹션이 없습니다.\n';
    }
  } else {
    output += '⚠️ docs/work-log.md가 없습니다. /game-init이 실행되지 않은 프로젝트일 수 있습니다.\n';
  }
} catch (err) {
  output += '⚠️ work-log 읽기 실패: ' + err.message + '\n';
}

// stdout으로 출력 → Claude 컨텍스트에 주입
if (output) {
  process.stdout.write(output);
}

process.exit(0);

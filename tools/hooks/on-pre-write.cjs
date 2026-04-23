#!/usr/bin/env node

/**
 * on-pre-write.js (v2)
 * PreToolUse Hook (matcher: Write) — 파일 쓰기 전 자동 실행
 * 
 * 역할:
 * 1. 이미지 파일 직접 생성 시 경고 (모든 상황)
 * 2. 기존 코드 파일 전체 덮어쓰기 감지 시 경고 (모든 상황)
 * 
 * 변경 이력:
 * v1 → v2: Patch Mode 의존 제거. 전체 덮어쓰기 경고를 모든 상황에서 적용.
 *          (규칙 0번 "코드 파일 전체를 Write로 덮어쓰지 않는다"의 물리적 보장)
 * 
 * Exit Codes:
 *   0 = 통과 (경고만 출력, 계속 진행)
 *   2 = 차단 (작업 중단, stderr가 에러 메시지로 표시)
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
    const hookInput = JSON.parse(inputData);
    const filePath = hookInput.tool_input?.file_path || '';

    // work-log.md가 없으면 게임 프로젝트가 아님 → 통과
    if (!fs.existsSync(workLogPath)) {
      process.exit(0);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();

    // --- 체크 1: 이미지 파일 직접 생성 감지 (모든 상황) ---
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];

    if (imageExtensions.includes(ext)) {
      const isInArtStudio = filePath.includes('art-studio');
      const isInHistory = filePath.includes('history');

      if (!isInArtStudio && !isInHistory) {
        process.stderr.write(
          `⚠️ [Hook] 이미지 파일 직접 생성이 감지되었습니다.\n` +
          `대상: ${filePath}\n` +
          `이미지 생성은 art-worker 스킬 또는 Art Studio를 통해 진행해주세요.\n` +
          `직접 이미지 파일을 생성하면 asset-manifest.json과 동기화가 깨집니다.\n`
        );
        // 경고만 하고 차단은 하지 않음 (exit 0)
        // 완전 차단이 필요하면 exit 2로 변경
      }
    }

    // --- 체크 2: 기존 코드 파일 전체 덮어쓰기 감지 (모든 상황) ---
    const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.html', '.css'];

    if (codeExtensions.includes(ext)) {
      const absolutePath = path.resolve(projectDir, filePath);

      // 기존 파일이 존재하는 경우에만 경고 (새 파일 생성은 허용)
      if (fs.existsSync(absolutePath)) {
        // 무시할 파일 (설정 파일 등은 Write가 자연스러움)
        const allowWritePaths = [
          'package.json',
          'tsconfig.json',
          'vite.config',
          'asset-manifest.json',
          'usage.json',
          'work-log.md',
          'art-studio/'
        ];

        const isAllowed = allowWritePaths.some(p => filePath.includes(p));

        if (!isAllowed) {
          process.stderr.write(
            `⚠️ [Hook] 기존 코드 파일 전체 덮어쓰기가 감지되었습니다.\n` +
            `대상: ${filePath}\n` +
            `Write(전체 덮어쓰기) 대신 Edit(부분 수정)을 사용해주세요.\n` +
            `전체 덮어쓰기는 다른 부분의 코드가 날아갈 수 있습니다.\n`
          );
          // 경고만 출력, 차단하지 않음
          // 강제 차단이 필요하면 process.exit(2)로 변경
        }
      }
    }

  } catch (err) {
    // Hook 에러는 조용히 처리
    process.stderr.write('[Hook] on-pre-write error: ' + err.message + '\n');
  }

  process.exit(0);
});

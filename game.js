const BOARD_COLS = 6;
const BOARD_ROWS = 8;
const MAX_LEVEL = 7;
const TIER_BLUEPRINT_LEVELS = [3, 4, 5];
const TIER_THRESHOLDS       = [0, 4, 8];   // 건물 몇 개부터 다음 티어
const TIER_SPAWN_WEIGHTS    = [
  [[1, 65], [2, 35]],
  [[1, 50], [2, 35], [3, 15]],
  [[1, 40], [2, 30], [3, 20], [4, 10]],
];
const ITEM_DEFS = [
  { level: 1, id: "wood",      label: "나무 토막", color: "#c8905a", img: "assets/item-1-wood.svg",      score: 10  },
  { level: 2, id: "plank",     label: "판자",      color: "#daa860", img: "assets/item-2-plank.svg",     score: 24  },
  { level: 3, id: "brick",     label: "벽돌",      color: "#e05a38", img: "assets/item-3-brick.svg",     score: 52  },
  { level: 4, id: "rebar",     label: "철근",      color: "#8a9bb0", img: "assets/item-4-rebar.svg",     score: 110 },
  { level: 5, id: "glass",     label: "유리창",    color: "#88c8e8", img: "assets/item-5-glass.svg",     score: 220 },
  { level: 6, id: "rooftile",  label: "지붕 기와", color: "#c85a3a", img: "assets/item-6-rooftile.svg",  score: 420 },
  { level: 7, id: "blueprint", label: "설계도",    color: "#2a6ab8", img: "assets/item-7-blueprint.svg", score: 760 },
];
const TOWN_BUILDINGS = [
  { name: "집",    img: "assets/building-1-house.svg"        },
  { name: "카페",  img: "assets/building-2-cafe.svg"         },
  { name: "편의점", img: "assets/building-3-convenience.svg" },
  { name: "빵집",  img: "assets/building-4-bakery.svg"       },
  { name: "꽃집",  img: "assets/building-5-flowerShop.svg"   },
  { name: "놀이터", img: "assets/building-6-playground.svg"  },
  { name: "공원",  img: "assets/building-7-park.svg"         },
  { name: "도서관", img: "assets/building-8-library.svg"     },
  { name: "병원",  img: "assets/building-9-hospital.svg"     },
  { name: "소방서", img: "assets/building-10-fireStation.svg"},
  { name: "경찰서", img: "assets/building-11-police.svg"     },
  { name: "학교",  img: "assets/building-12-school.svg"      },
];
const BUILDING_SLOT_WIDTH = 96;
const BUILDING_START_X = 24;
const NEIGHBOR_STEPS = [
  [-1, -1], [0, -1], [1, -1],
  [-1,  0],          [1,  0],
  [-1,  1], [0,  1], [1,  1],
];

const boardElement          = document.querySelector("#board");
const boardShellElement     = document.querySelector("#boardShell");
const resetButton           = document.querySelector("#resetButton");
const guideButton           = document.querySelector("#guideButton");
const guideModal            = document.querySelector("#guideModal");
const guideBackdrop         = document.querySelector("#guideBackdrop");
const guideCloseButton      = document.querySelector("#guideCloseButton");
const statusTextElement     = document.querySelector("#statusText");
const moveCountElement      = document.querySelector("#moveCount");
const mergeCountElement     = document.querySelector("#mergeCount");
const scoreCountElement     = document.querySelector("#scoreCount");
const bestLevelElement      = document.querySelector("#bestLevel");
const chargeCountElement    = document.querySelector("#chargeCount");
const emptyCountElement     = document.querySelector("#emptyCount");
const brownBubbleElement    = document.querySelector("#brownBubble");
const brownCharacterElement = document.querySelector(".brown-character");
const dioramaSceneElement   = document.querySelector("#dioramaScene");
const dioramaViewportElement = document.querySelector("#dioramaViewport");

const positions      = buildPositions();
const positionLookup = new Map(positions.map((pos) => [pos.key, pos]));

let layoutMetrics      = { cellSize: 56, gap: 5 };
let board              = new Map();
let nextItemId         = 1;
let selectedKey        = null;
let dragState          = null;
let inputLocked        = false;
let moves              = 0;
let merges             = 0;
let score              = 0;
let highestLevel       = 1;
let dispenserKey       = key(2, 3);
let audioContext       = null;
let noiseBuffer        = null;
let completedBuildings = 0;
let startedBuildings   = 0;
let buildingStages     = new Array(TOWN_BUILDINGS.length).fill(0); // 0=미착공 1=1/3 2=1/2 3=완성
const buildingEls      = new Array(TOWN_BUILDINGS.length).fill(null);
let brownBubbleTimer   = null;
let brownLeft          = 20;
let isWalkingToBuilding = false;

// ─── Positions ───────────────────────────────────────────────

function buildPositions() {
  const built = [];
  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let col = 0; col < BOARD_COLS; col += 1) {
      built.push({ row, col, key: key(col, row), x: 0, y: 0 });
    }
  }
  return built;
}

function key(col, row) {
  return `${col},${row}`;
}

// ─── Item helpers ─────────────────────────────────────────────

function createItem(level = 1) {
  return { id: nextItemId += 1, level };
}

function createDispenser() {
  return { id: `dispenser-${Date.now()}`, kind: "dispenser" };
}

function getItemDef(level) {
  return ITEM_DEFS[Math.min(MAX_LEVEL, Math.max(1, level)) - 1];
}

// ─── Game init / reset ────────────────────────────────────────

function resetGame() {
  nextItemId   = 0;
  board        = new Map();
  selectedKey  = null;
  dragState    = null;
  inputLocked  = false;
  moves        = 0;
  merges       = 0;
  score        = 0;
  highestLevel       = 1;
  completedBuildings = 0;
  startedBuildings   = 0;
  buildingStages     = new Array(TOWN_BUILDINGS.length).fill(0);
  buildingEls.fill(null);
  dispenserKey = key(2, 3);

  boardElement.innerHTML = "";
  buildBoardSlots();
  updateBoardGeometry();
  seedInitialItems();
  renderBoard();
  resetDiorama();
  updateCounters();
  updateDispenserState();
  brownBubbleElement?.classList.remove("visible");
  statusTextElement.textContent = "아이템을 길게 눌러 빈 칸으로 옮기거나, 같은 단계 아이템 위에 드롭해서 머지하세요.";
}

function buildBoardSlots() {
  positions.forEach((position) => {
    const slot = document.createElement("span");
    slot.className    = "grid-slot";
    slot.dataset.key  = position.key;
    slot.style.left   = `${position.x}px`;
    slot.style.top    = `${position.y}px`;
    boardElement.append(slot);
  });
}

function seedInitialItems() {
  board.set(dispenserKey, createDispenser());
  board.set(key(0, 0), createItem(1));
  board.set(key(5, 0), createItem(1));
  board.set(key(0, 1), createItem(2));
  board.set(key(5, 1), createItem(2));
  board.set(key(0, 3), createItem(1));
  board.set(key(5, 3), createItem(2));
  board.set(key(0, 6), createItem(3));               // 도면 예시
  board.set(key(2, 7), createItem(3));               // 도면 (바로 머지 가능)
  board.set(key(3, 7), createItem(3));               // 도면 (바로 머지 가능)
}

function updateBoardGeometry() {
  const shellWidth  = boardShellElement.clientWidth || 390;
  const innerWidth  = shellWidth - 32;
  const cellSize    = Math.max(44, Math.min(52, (innerWidth - 5 * 5) / BOARD_COLS));
  const gap         = Math.max(4, Math.min(6, cellSize * 0.1));
  const boardWidth  = BOARD_COLS * cellSize + (BOARD_COLS - 1) * gap;
  const boardHeight = BOARD_ROWS * cellSize + (BOARD_ROWS - 1) * gap;

  layoutMetrics = { cellSize, gap };
  document.documentElement.style.setProperty("--cell-size",   `${cellSize}px`);
  document.documentElement.style.setProperty("--cell-gap",    `${gap}px`);
  document.documentElement.style.setProperty("--board-width", `${boardWidth}px`);
  document.documentElement.style.setProperty("--board-height",`${boardHeight}px`);

  positions.forEach((position) => {
    position.x = position.col * (cellSize + gap);
    position.y = position.row * (cellSize + gap);
  });

  boardElement.querySelectorAll(".grid-slot").forEach((slot) => {
    const position = positionLookup.get(slot.dataset.key);
    slot.style.left = `${position.x}px`;
    slot.style.top  = `${position.y}px`;
  });

  renderBoard();
}

// ─── Board render ─────────────────────────────────────────────

function renderBoard() {
  const liveIds = new Set();

  positions.forEach((position) => {
    const item = board.get(position.key);
    if (!item) return;

    liveIds.add(String(item.id));
    const element    = getOrCreateItemElement(item, position.key);
    const isDispenser  = item.kind === "dispenser";
    const isBlueprint  = !isDispenser && item.level === getBlueprintLevel();
    const def          = isDispenser ? null : getItemDef(isBlueprint ? 7 : item.level);
    const image        = element.querySelector("img");

    image.src = isDispenser ? "assets/dispenser.svg" : def.img;
    element.style.setProperty("--item-color", isDispenser ? "#ffd071" : def.color);
    element.style.setProperty("--x", `${position.x}px`);
    element.style.setProperty("--y", `${position.y}px`);
    element.dataset.key = position.key;
    element.classList.toggle("dispenser",       isDispenser);
    element.classList.toggle("selected",        selectedKey === position.key);
    element.classList.toggle("blueprint-ready", !isDispenser && item.level === getBlueprintLevel());
    element.setAttribute("aria-label", isDispenser ? "자재 창고" : `${def.label} 아이템`);
  });

  boardElement.querySelectorAll(".item").forEach((element) => {
    if (!liveIds.has(element.dataset.id)) element.remove();
  });
}

function getOrCreateItemElement(item, boardKey) {
  const existing = boardElement.querySelector(`.item[data-id="${item.id}"]`);
  if (existing) return existing;

  const element  = document.createElement("button");
  element.className  = "item";
  element.type       = "button";
  element.dataset.id  = String(item.id);
  element.dataset.key = boardKey;

  const image = document.createElement("img");
  image.alt   = "";
  element.append(image);

  element.addEventListener("pointerdown", (event) => startDrag(event, item.id));
  boardElement.append(element);
  return element;
}

// ─── Diorama ─────────────────────────────────────────────────

function resetDiorama() {
  if (!dioramaSceneElement) return;

  // Remove all buildings
  dioramaSceneElement.querySelectorAll(".diorama-building").forEach((el) => el.remove());

  // Reset scene width
  dioramaSceneElement.style.width = "";

  // Reset brown position
  brownLeft = 20;
  isWalkingToBuilding = false;
  if (brownCharacterElement) {
    brownCharacterElement.style.setProperty("--brown-left", "20px");
    brownCharacterElement.classList.remove("facing-left");
    brownCharacterElement.classList.add("facing-right");
  }

  // Scroll back to start
  if (dioramaViewportElement) dioramaViewportElement.scrollLeft = 0;
}

async function animateBuildingFlyToTown(fromBoardKey, index) {
  if (!dioramaSceneElement || !dioramaViewportElement) return;
  if (index >= TOWN_BUILDINGS.length) return;

  const def  = TOWN_BUILDINGS[index];
  const xPos = BUILDING_START_X + index * BUILDING_SLOT_WIDTH;

  // Expand scene and scroll first
  const neededWidth = xPos + BUILDING_SLOT_WIDTH + 80;
  const currentWidth = dioramaSceneElement.offsetWidth || 400;
  if (neededWidth > currentWidth) {
    dioramaSceneElement.style.width = `${neededWidth}px`;
  }
  dioramaViewportElement.scrollTo({ left: Math.max(0, xPos - 80), behavior: "smooth" });
  await wait(380); // scroll 완료 대기

  // 출발점: 보드 셀 화면 좌표
  const boardRect = boardElement.getBoundingClientRect();
  const pos       = positionLookup.get(fromBoardKey);
  if (!pos) return;
  const startX = boardRect.left + pos.x + layoutMetrics.cellSize / 2;
  const startY = boardRect.top  + pos.y + layoutMetrics.cellSize / 2;

  // 도착점: 디오라마 내 건물 슬롯 화면 좌표
  const vpRect    = dioramaViewportElement.getBoundingClientRect();
  const scrollLeft = dioramaViewportElement.scrollLeft;
  const endX = vpRect.left + (xPos - scrollLeft) + 26;
  const endY = vpRect.bottom - 72;

  const dx = endX - startX;
  const dy = endY - startY;

  // 플라이 엘리먼트 생성
  const flyEl = document.createElement("div");
  flyEl.className = "building-fly";
  flyEl.style.left = `${startX}px`;
  flyEl.style.top  = `${startY}px`;
  flyEl.style.transform = "translate(-50%, -50%) scale(0.25)";
  flyEl.style.opacity   = "0";

  const img     = document.createElement("img");
  img.src       = def.img;
  img.alt       = def.name;
  img.draggable = false;
  flyEl.appendChild(img);
  document.body.appendChild(flyEl);

  // requestAnimationFrame 기반 포물선 비행
  const DURATION = 820;
  const startTime = performance.now();

  await new Promise((resolve) => {
    function frame(now) {
      const t    = Math.min((now - startTime) / DURATION, 1);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      const x     = startX + dx * ease;
      const arc   = Math.sin(Math.PI * t) * Math.min(120, Math.abs(dy) * 0.7);
      const y     = startY + dy * ease - arc;
      const scale = 0.25 + ease * 0.75;
      const alpha = t < 0.08 ? t / 0.08 : t > 0.84 ? (1 - t) / 0.16 : 1;

      flyEl.style.left      = `${x}px`;
      flyEl.style.top       = `${y}px`;
      flyEl.style.transform = `translate(-50%, -50%) scale(${scale})`;
      flyEl.style.opacity   = String(alpha);

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        flyEl.remove();
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}

function addBuildingToTown(index) {
  if (!dioramaSceneElement || !dioramaViewportElement) return;
  if (index >= TOWN_BUILDINGS.length) return;

  const def  = TOWN_BUILDINGS[index];
  const xPos = BUILDING_START_X + index * BUILDING_SLOT_WIDTH;

  // 건물 엘리먼트 생성 및 팝인
  const buildingEl      = document.createElement("div");
  buildingEl.className  = "diorama-building building-new stage-1";
  buildingEl.style.left = `${xPos}px`;

  const img     = document.createElement("img");
  img.src       = def.img;
  img.alt       = def.name;
  img.draggable = false;
  buildingEl.appendChild(img);

  dioramaSceneElement.insertBefore(buildingEl, brownCharacterElement);
  buildingEls[index] = buildingEl;

  setTimeout(() => buildingEl.classList.remove("building-new"), 700);

  // 브라운 이동
  isWalkingToBuilding = true;
  walkBrownTo(Math.max(0, xPos - 32));
  setTimeout(() => { isWalkingToBuilding = false; }, 2200);

  updateBrownMood(`${def.name} 착공! 브라운이 달려가고 있어요.`);
  updateBrownSpeed();
}

function updateBuildingStage(index, stage) {
  const el = buildingEls[index];
  if (!el) return;
  el.classList.remove("stage-1", "stage-2");
  if (stage < 3) {
    el.classList.add(`stage-${stage}`);
  }
  if (stage === 3) {
    el.classList.add("building-complete");
    setTimeout(() => el.classList.remove("building-complete"), 700);
    spawnBuildingParticles(el);
  }
}

function spawnBuildingParticles(el) {
  const rect   = el.getBoundingClientRect();
  const cx     = rect.left + rect.width  / 2;
  const cy     = rect.top  + rect.height / 2;
  const colors = ["#ffbe2f", "#ff8a1f", "#4fcf64", "#88c8e8", "#f08f54", "#ffffff"];
  const COUNT  = 22;

  for (let i = 0; i < COUNT; i++) {
    const p   = document.createElement("span");
    const ang = (i / COUNT) * Math.PI * 2;
    const spd = 60 + Math.random() * 80;
    const tx  = Math.cos(ang) * spd;
    const ty  = Math.sin(ang) * spd;
    const sz  = 5 + Math.random() * 6;
    p.style.cssText = `
      position:fixed; left:${cx}px; top:${cy}px;
      width:${sz}px; height:${sz}px;
      border-radius:50%;
      background:${colors[i % colors.length]};
      pointer-events:none; z-index:999;
      transform:translate(-50%,-50%);
      animation:bldgParticle 0.7s ease-out forwards;
      --tx:${tx}px; --ty:${ty}px;
    `;
    document.body.appendChild(p);
    p.addEventListener("animationend", () => p.remove(), { once: true });
  }
}

function walkBrownTo(x) {
  if (!brownCharacterElement) return;
  const dx = x - brownLeft;
  if (Math.abs(dx) < 6) return;
  brownLeft = x;
  if (dx > 0) {
    brownCharacterElement.classList.remove("facing-left");
    brownCharacterElement.classList.add("facing-right");
  } else {
    brownCharacterElement.classList.remove("facing-right");
    brownCharacterElement.classList.add("facing-left");
  }
  brownCharacterElement.style.setProperty("--brown-left", `${x}px`);
}

function getBrownWalkConfig() {
  const t = Math.min(completedBuildings / TOWN_BUILDINGS.length, 1);
  return {
    transitionSec:    1.4 - t * 0.8,   // 1.4s → 0.6s
    wanderIntervalMs: 5000 - t * 3000,  // 5000ms → 2000ms
  };
}

function updateBrownSpeed() {
  if (!brownCharacterElement) return;
  const { transitionSec } = getBrownWalkConfig();
  brownCharacterElement.style.setProperty("--brown-walk-speed", `${transitionSec.toFixed(2)}s`);
}

function startBrownWander() {
  function scheduleNext() {
    const { wanderIntervalMs } = getBrownWalkConfig();
    setTimeout(() => {
      if (!isWalkingToBuilding && dioramaViewportElement) {
        const visibleStart = dioramaViewportElement.scrollLeft;
        const visibleWidth = dioramaViewportElement.clientWidth;
        const targetX = visibleStart + 20 + Math.random() * Math.max(0, visibleWidth - 160);
        walkBrownTo(targetX);
      }
      scheduleNext();
    }, wanderIntervalMs);
  }
  scheduleNext();
}

function initDioramaDrag() {
  const el = dioramaViewportElement;
  if (!el) return;

  let startX       = 0;
  let scrollStart  = 0;
  let isDragging   = false;
  let hasMoved     = false;

  el.addEventListener("mousedown", (e) => {
    startX      = e.clientX;
    scrollStart = el.scrollLeft;
    isDragging  = true;
    hasMoved    = false;
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    if (!hasMoved && Math.abs(dx) > 4) {
      hasMoved = true;
      el.classList.add("is-dragging");
    }
    if (hasMoved) el.scrollLeft = scrollStart - dx;
  });

  window.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;
    hasMoved   = false;
    el.classList.remove("is-dragging");
  });
}

// ─── Input: drag & drop ───────────────────────────────────────

function handleItemClick(boardKey) {
  if (inputLocked) return;
  void resumeAudio();
  playTapSound();

  const clickedItem = board.get(boardKey);
  if (clickedItem?.kind === "dispenser") {
    void handleDispenserTap(boardKey);
    return;
  }

  if (selectedKey === boardKey) {
    selectedKey = null;
    renderBoard();
    statusTextElement.textContent = "선택을 해제했어요.";
    return;
  }

  if (!selectedKey) {
    selectedKey = boardKey;
    renderBoard();
    statusTextElement.textContent = "이제 빈 칸이나 같은 단계 아이템으로 가져가 보세요.";
    return;
  }

  void commitMove(selectedKey, boardKey);
}

function startDrag(event, itemId) {
  if (inputLocked || event.button > 0) return;

  const entry = [...board.entries()].find(([, item]) => item.id === itemId);
  if (!entry) return;

  void resumeAudio();
  const [originKey]  = entry;
  const element      = boardElement.querySelector(`.item[data-id="${itemId}"]`);
  const boardRect    = boardElement.getBoundingClientRect();
  const position     = positionLookup.get(originKey);

  selectedKey = originKey;
  dragState   = {
    itemId,
    originKey,
    element,
    boardRect,
    pointerId:    event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    offsetX: event.clientX - (boardRect.left + position.x + layoutMetrics.cellSize / 2),
    offsetY: event.clientY - (boardRect.top  + position.y + layoutMetrics.cellSize / 2),
    targetKey: originKey,
    moved: false,
  };

  element.setPointerCapture?.(event.pointerId);
  element.addEventListener("pointermove",  handleDragMove);
  element.addEventListener("pointerup",    handleDragEnd);
  element.addEventListener("pointercancel",handleDragEnd);
  renderBoard();
}

function handleDragMove(event) {
  if (!dragState) return;

  const moveDistance = Math.hypot(
    event.clientX - dragState.startClientX,
    event.clientY - dragState.startClientY
  );
  if (moveDistance > 8 && !dragState.moved) {
    dragState.moved = true;
    dragState.element.classList.add("dragging");
  }
  if (!dragState.moved) return;

  const x = event.clientX - dragState.boardRect.left - layoutMetrics.cellSize / 2 - dragState.offsetX;
  const y = event.clientY - dragState.boardRect.top  - layoutMetrics.cellSize / 2 - dragState.offsetY;
  dragState.element.style.setProperty("--x", `${x}px`);
  dragState.element.style.setProperty("--y", `${y}px`);

  const targetKey     = findClosestKey(event.clientX, event.clientY);
  dragState.targetKey = targetKey;
  highlightDropTarget(targetKey);
}

function handleDragEnd() {
  if (!dragState) return;

  const { originKey, targetKey, element, moved } = dragState;
  clearDropTargetHighlights();
  element.classList.remove("dragging");
  element.removeEventListener("pointermove",  handleDragMove);
  element.removeEventListener("pointerup",    handleDragEnd);
  element.removeEventListener("pointercancel",handleDragEnd);
  dragState = null;

  if (!moved) {
    handleItemClick(originKey);
    return;
  }
  void commitMove(originKey, targetKey);
}

function highlightDropTarget(targetKey) {
  clearDropTargetHighlights();
  if (!targetKey || targetKey === dragState?.originKey) return;
  const slot = boardElement.querySelector(`.grid-slot[data-key="${targetKey}"]`);
  slot?.classList.add("drop-target");
}

function clearDropTargetHighlights() {
  boardElement.querySelectorAll(".grid-slot.drop-target").forEach((slot) => {
    slot.classList.remove("drop-target");
  });
}

function findClosestKey(clientX, clientY) {
  const rect   = boardElement.getBoundingClientRect();
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  let bestKey  = null;
  let bestDist = Number.POSITIVE_INFINITY;

  positions.forEach((position) => {
    const cx   = position.x + layoutMetrics.cellSize / 2;
    const cy   = position.y + layoutMetrics.cellSize / 2;
    const dist = Math.hypot(localX - cx, localY - cy);
    if (dist < bestDist) { bestDist = dist; bestKey = position.key; }
  });

  return bestDist <= layoutMetrics.cellSize * 0.72 ? bestKey : null;
}

// ─── Move / merge logic ───────────────────────────────────────

async function commitMove(originKey, targetKey) {
  renderBoard();
  if (inputLocked) return;

  const originItem = board.get(originKey);
  if (!originItem) { selectedKey = null; renderBoard(); return; }

  if (!targetKey || originKey === targetKey) { selectedKey = originKey; renderBoard(); return; }

  inputLocked = true;

  try {
    const targetItem = board.get(targetKey);

    if (!targetItem) {
      // Move to empty slot
      board.delete(originKey);
      board.set(targetKey, originItem);
      if (originItem.kind === "dispenser") dispenserKey = targetKey;
      moves += 1;
      playMoveSound();
      statusTextElement.textContent = "아이템을 이동했어요.";
      updateCounters();
      updateDispenserState();
      updateBrownMood("브라운이 고개를 끄덕였어요.");

    } else if (
      originItem.kind !== "dispenser" &&
      targetItem.kind !== "dispenser" &&
      originItem.level === targetItem.level &&
      targetItem.level < getBlueprintLevel()
    ) {
      // Normal merge → level + 1
      await animateMerge(originKey, targetKey, targetItem.level);
      board.delete(originKey);
      board.set(targetKey, createItem(targetItem.level + 1));
      moves    += 1;
      merges   += 1;
      const mergedDef = getItemDef(targetItem.level + 1);
      score        += mergedDef.score;
      highestLevel  = Math.max(highestLevel, mergedDef.level);
      playMergeSound(mergedDef.level);
      statusTextElement.textContent = `${mergedDef.label}로 머지됐어요!`;
      updateCounters();
      updateDispenserState();
      updateBrownMood(`${mergedDef.label}! 브라운이 신나서 깡충깡충 뛰었어요.`);

    } else if (
      originItem.kind !== "dispenser" &&
      targetItem.kind !== "dispenser" &&
      originItem.level === getBlueprintLevel() &&
      targetItem.level === getBlueprintLevel()
    ) {
      // Building merge → advance construction stage or start new building
      const prevBlueprintLevel = getBlueprintLevel();
      await animateMerge(originKey, targetKey, prevBlueprintLevel);
      board.delete(originKey);
      board.delete(targetKey);
      moves  += 1;
      merges += 1;
      score  += Math.round(200 * Math.pow(2, prevBlueprintLevel - 2) / 3);
      highestLevel = Math.max(highestLevel, prevBlueprintLevel);
      renderBoard();
      playBuildingCompleteSound();
      updateCounters();
      updateDispenserState();

      const inProgressIdx = buildingStages.findIndex(s => s >= 1 && s < 3);

      if (inProgressIdx >= 0) {
        // 공사 중인 건물을 한 단계 올림
        const newStage = buildingStages[inProgressIdx] + 1;
        buildingStages[inProgressIdx] = newStage;
        const isComplete = newStage === 3;
        if (isComplete) completedBuildings++;
        const newBlueprintLevel = getBlueprintLevel();
        const tieredUp = newBlueprintLevel > prevBlueprintLevel;
        updateBuildingStage(inProgressIdx, newStage);
        if (isComplete) {
          if (tieredUp) {
            updateBrownMood(`${newBlueprintLevel}단계 도면 해금! 이제 더 높은 재료로 건물을 지어요.`);
          } else {
            updateBrownMood(`${TOWN_BUILDINGS[inProgressIdx].name} 완성! 브라운이 기뻐해요.`);
          }
        } else {
          const progressMsg = newStage === 2 ? "절반 완성!" : "공사 시작!";
          updateBrownMood(`${TOWN_BUILDINGS[inProgressIdx].name} ${progressMsg}`);
        }
      } else if (startedBuildings < TOWN_BUILDINGS.length) {
        // 새 건물 착공 (stage 1)
        const slot = startedBuildings++;
        buildingStages[slot] = 1;
        statusTextElement.textContent = "도면이 완성됐어요! 건물이 마을로 날아가요.";
        animateBuildingFlyToTown(targetKey, slot).then(() => {
          addBuildingToTown(slot);
        });
      }

    } else {
      // Reject
      playRejectSound();
      statusTextElement.textContent =
        originItem.kind === "dispenser"
          ? "자재 창고는 머지되지 않아요."
          : "같은 단계 재료끼리만 머지할 수 있어요.";
      selectedKey = originKey;
      renderBoard();
      return;
    }

    selectedKey = null;
    renderBoard();

    if (countEmptySlots() === 0) {
      updateBrownMood("보드가 가득 찼어요. 머지로 공간을 만들어야 해요.");
      statusTextElement.textContent = "빈 칸이 없어요. 낮은 단계 재료부터 합쳐 공간을 만들어 주세요.";
    }
  } finally {
    inputLocked = false;
  }
}

// ─── Animations ───────────────────────────────────────────────

async function animateMerge(originKey, targetKey, level) {
  const originCenter = getBoardCenter(originKey);
  const targetCenter = getBoardCenter(targetKey);
  const def          = getItemDef(Math.min(level, MAX_LEVEL));
  const deltaX       = targetCenter.x - originCenter.x;
  const deltaY       = targetCenter.y - originCenter.y;

  const originElement = boardElement.querySelector(`.item[data-key="${originKey}"]`);
  const targetElement = boardElement.querySelector(`.item[data-key="${targetKey}"]`);
  originElement?.classList.add("merging");
  targetElement?.classList.add("selected");

  const beam = document.createElement("span");
  beam.className = "merge-beam";
  beam.style.setProperty("--beam-x",      `${originCenter.x}px`);
  beam.style.setProperty("--beam-y",      `${originCenter.y}px`);
  beam.style.setProperty("--beam-length", `${Math.hypot(deltaX, deltaY)}px`);
  beam.style.setProperty("--beam-angle",  `${Math.atan2(deltaY, deltaX)}rad`);
  beam.style.setProperty("--beam-color",  def.color);
  boardElement.append(beam);
  beam.addEventListener("animationend", () => beam.remove(), { once: true });

  const core = document.createElement("span");
  core.className = "merge-core";
  core.style.left = `${targetCenter.x}px`;
  core.style.top  = `${targetCenter.y}px`;
  boardElement.append(core);
  core.addEventListener("animationend", () => core.remove(), { once: true });

  const ring = document.createElement("span");
  ring.className = "merge-ring";
  ring.style.left = `${targetCenter.x}px`;
  ring.style.top  = `${targetCenter.y}px`;
  ring.style.setProperty("--ring-color", def.color);
  boardElement.append(ring);
  ring.addEventListener("animationend", () => ring.remove(), { once: true });

  for (let index = 0; index < 8; index += 1) {
    const angle    = (Math.PI * 2 * index) / 8;
    const particle = document.createElement("span");
    particle.className = "merge-particle";
    particle.style.left = `${targetCenter.x}px`;
    particle.style.top  = `${targetCenter.y}px`;
    particle.style.setProperty("--particle-color", def.color);
    particle.style.setProperty("--burst-x", `${Math.cos(angle) * (22 + (index % 2) * 8)}px`);
    particle.style.setProperty("--burst-y", `${Math.sin(angle) * (22 + (index % 2) * 8)}px`);
    boardElement.append(particle);
    particle.addEventListener("animationend", () => particle.remove(), { once: true });
  }

  await wait(260);
}

async function handleDispenserTap(boardKey) {
  void resumeAudio();
  if (inputLocked) return;

  const emptyKeys = getAdjacentEmptyKeys(boardKey);
  if (emptyKeys.length === 0) {
    playRejectSound();
    statusTextElement.textContent = "자재 창고 주변에 빈 칸이 없어요.";
    updateBrownMood("브라운이 주변 공간부터 정리하자고 손짓했어요.");
    return;
  }

  inputLocked = true;
  try {
    playDispenserSound();
    const spawnCount = Math.min(Math.random() < 0.55 ? 1 : 2, emptyKeys.length);
    const chosen     = [...emptyKeys].sort(() => Math.random() - 0.5).slice(0, spawnCount);

    const spawnedEntries = chosen.map((nextKey) => {
      const level = randomSpawnLevel();
      const item  = createItem(level);
      board.set(nextKey, item);
      highestLevel = Math.max(highestLevel, level);
      return { key: nextKey, item };
    });

    renderBoard();
    await animateSpawnItems(spawnedEntries);
    updateCounters();
    updateDispenserState();
    updateBrownMood("자재 창고에서 재료를 꺼냈어요!");
    statusTextElement.textContent = `자재 창고에서 재료 ${spawnCount}개가 나왔어요.`;
  } finally {
    inputLocked = false;
  }
}

function getAdjacentEmptyKeys(boardKey) {
  const position = positionLookup.get(boardKey);
  if (!position) return [];
  return NEIGHBOR_STEPS
    .map(([cs, rs]) => key(position.col + cs, position.row + rs))
    .filter((k) => positionLookup.has(k) && !board.has(k));
}

async function animateSpawnItems(entries) {
  const origin = getBoardCenter(dispenserKey);

  entries.forEach(({ key: nextKey, item }, index) => {
    const center = getBoardCenter(nextKey);
    const drop   = document.createElement("span");
    drop.className = "spawn-drop";
    drop.style.setProperty("--start-x", `${origin.x}px`);
    drop.style.setProperty("--start-y", `${origin.y}px`);
    drop.style.setProperty("--fly-x",   `${center.x - origin.x}px`);
    drop.style.setProperty("--fly-y",   `${center.y - origin.y}px`);
    drop.style.animationDelay = `${index * 80}ms`;
    boardElement.append(drop);
    drop.addEventListener("animationend", () => drop.remove(), { once: true });

    const element = boardElement.querySelector(`.item[data-id="${item.id}"]`);
    if (!element) return;
    element.classList.add("spawn-preview");
    element.style.transition = "none";
    element.style.setProperty("--x", `${origin.x - layoutMetrics.cellSize / 2}px`);
    element.style.setProperty("--y", `${origin.y - layoutMetrics.cellSize / 2}px`);
    element.style.setProperty("--scale", "0.42");
    void element.offsetWidth;

    window.setTimeout(() => {
      element.style.transition =
        "transform 300ms cubic-bezier(0.18, 0.82, 0.2, 1), box-shadow 150ms ease, opacity 150ms ease";
      element.style.setProperty("--x", `${center.x - layoutMetrics.cellSize / 2}px`);
      element.style.setProperty("--y", `${center.y - layoutMetrics.cellSize / 2}px`);
      element.style.setProperty("--scale", "1");
      window.setTimeout(() => {
        element.classList.remove("spawn-preview");
        element.style.transition = "";
      }, 320);
    }, index * 60);
  });

  await wait(420 + entries.length * 90);
}

// ─── Helpers ──────────────────────────────────────────────────

function getBoardCenter(boardKey) {
  const position = positionLookup.get(boardKey);
  return {
    x: position.x + layoutMetrics.cellSize / 2,
    y: position.y + layoutMetrics.cellSize / 2,
  };
}

function updateCounters() {
  moveCountElement.textContent  = String(moves);
  mergeCountElement.textContent = String(merges);
  scoreCountElement.textContent = String(score);
  bestLevelElement.textContent  = `${highestLevel}단계`;
  emptyCountElement.textContent = String(countEmptySlots());
}

function countEmptySlots() {
  return positions.length - board.size;
}

function updateDispenserState() {
  chargeCountElement.textContent = `${getBlueprintLevel()}단계 도면`;
}

function updateBrownMood(message) {
  if (!brownBubbleElement) return;
  brownBubbleElement.textContent = message;
  brownBubbleElement.classList.add("visible");
  clearTimeout(brownBubbleTimer);
  brownBubbleTimer = setTimeout(() => {
    brownBubbleElement.classList.remove("visible");
  }, 3000);
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getBlueprintLevel() {
  for (let i = TIER_BLUEPRINT_LEVELS.length - 1; i >= 0; i--) {
    if (completedBuildings >= TIER_THRESHOLDS[i]) return TIER_BLUEPRINT_LEVELS[i];
  }
  return TIER_BLUEPRINT_LEVELS[0];
}

function randomSpawnLevel() {
  const tierIdx = TIER_BLUEPRINT_LEVELS.indexOf(getBlueprintLevel());
  const weights = TIER_SPAWN_WEIGHTS[Math.min(tierIdx, TIER_SPAWN_WEIGHTS.length - 1)];
  const total   = weights.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [level, weight] of weights) {
    r -= weight;
    if (r <= 0) return level;
  }
  return weights[0][0];
}

// ─── Audio ────────────────────────────────────────────────────

async function resumeAudio() {
  const context = getAudioContext();
  if (!context) return;
  if (context.state === "suspended") {
    try { await context.resume(); } catch (e) { console.warn(e); }
  }
}

function getAudioContext() {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  if (!audioContext) audioContext = new AudioCtor();
  return audioContext;
}

function getNoiseBuffer() {
  const context = getAudioContext();
  if (!context) return null;
  if (noiseBuffer) return noiseBuffer;
  noiseBuffer = context.createBuffer(1, context.sampleRate * 0.6, context.sampleRate);
  const data  = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

function playTone({ frequency, duration = 0.12, type = "triangle", gain = 0.05, when = 0, attack = 0.01, release = 0.12 }) {
  const context = getAudioContext();
  if (!context) return;
  const osc      = context.createOscillator();
  const gainNode = context.createGain();
  const start    = context.currentTime + when;
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  gainNode.gain.setValueAtTime(0.0001, start);
  gainNode.gain.linearRampToValueAtTime(gain, start + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration + release);
  osc.connect(gainNode).connect(context.destination);
  osc.start(start);
  osc.stop(start + duration + release + 0.02);
}

function playNoise({ duration = 0.14, gain = 0.02, frequency = 1200, when = 0 }) {
  const context = getAudioContext();
  const buffer  = getNoiseBuffer();
  if (!context || !buffer) return;
  const source   = context.createBufferSource();
  const filter   = context.createBiquadFilter();
  const gainNode = context.createGain();
  const start    = context.currentTime + when;
  source.buffer  = buffer;
  filter.type    = "bandpass";
  filter.frequency.setValueAtTime(frequency, start);
  gainNode.gain.setValueAtTime(gain, start);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(gainNode).connect(context.destination);
  source.start(start);
  source.stop(start + duration + 0.02);
}

function playTapSound() {
  playTone({ frequency: 480, duration: 0.04, type: "sine", gain: 0.025 });
}

function playMoveSound() {
  playTone({ frequency: 380, duration: 0.08, gain: 0.04 });
  playTone({ frequency: 520, duration: 0.08, gain: 0.03, when: 0.05 });
}

function playMergeSound(level) {
  const base = 420 + level * 32;
  playTone({ frequency: base,        duration: 0.09, gain: 0.05 });
  playTone({ frequency: base * 1.26, duration: 0.12, gain: 0.045, when: 0.07 });
  playTone({ frequency: base * 1.6,  duration: 0.15, type: "sine", gain: 0.04, when: 0.14 });
  playNoise({ duration: 0.16, gain: 0.016, frequency: 1500 + level * 60, when: 0.02 });
}

function playDispenserSound() {
  playTone({ frequency: 360, duration: 0.12, gain: 0.045 });
  playTone({ frequency: 520, duration: 0.12, gain: 0.04,  when: 0.08 });
  playTone({ frequency: 720, duration: 0.14, type: "sine", gain: 0.035, when: 0.16 });
}

function playBuildingCompleteSound() {
  playTone({ frequency: 523, duration: 0.12, type: "sine", gain: 0.06 });
  playTone({ frequency: 659, duration: 0.12, type: "sine", gain: 0.055, when: 0.10 });
  playTone({ frequency: 784, duration: 0.18, type: "sine", gain: 0.05,  when: 0.20 });
  playTone({ frequency: 1046,duration: 0.26, type: "sine", gain: 0.045, when: 0.32 });
  playNoise({ duration: 0.2, gain: 0.018, frequency: 2000, when: 0.04 });
}

function playRejectSound() {
  playTone({ frequency: 280, duration: 0.08, type: "sawtooth", gain: 0.02 });
  playTone({ frequency: 220, duration: 0.08, type: "sawtooth", gain: 0.015, when: 0.08 });
}

// ─── Guide modal ──────────────────────────────────────────────

function openGuideModal() { guideModal?.removeAttribute("hidden"); }
function closeGuideModal() { guideModal?.setAttribute("hidden", ""); }

// ─── Event listeners & init ───────────────────────────────────

window.addEventListener("resize", updateBoardGeometry);
resetButton.addEventListener("click", resetGame);
guideButton?.addEventListener("click", openGuideModal);
guideCloseButton?.addEventListener("click", closeGuideModal);
guideBackdrop?.addEventListener("click", closeGuideModal);

window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() !== "b" || inputLocked) return;
  const emptyKeys = positions.map((p) => p.key).filter((k) => !board.has(k));
  if (emptyKeys.length === 0) {
    statusTextElement.textContent = "빈 칸이 없어서 설계도를 놓을 수 없어요.";
    return;
  }
  const targetKey = emptyKeys[Math.floor(Math.random() * emptyKeys.length)];
  const bl = getBlueprintLevel();
  board.set(targetKey, createItem(bl));
  highestLevel = Math.max(highestLevel, bl);
  renderBoard();
  updateCounters();
  updateBrownMood(`치트! ${bl}단계 도면이 나타났어요.`);
});

resetGame();
startBrownWander();
initDioramaDrag();

const BOARD_COLS = 6;
const BOARD_ROWS = 8;
const DISPENSER_RECHARGE_MOVES = 2;
const MAX_LEVEL = 8;
const ITEM_DEFS = [
  { level: 1, id: "seed", label: "씨앗", color: "#ffc85a", img: "assets/item-1-seed.svg", score: 10 },
  { level: 2, id: "sprout", label: "새싹", color: "#9be089", img: "assets/item-2-sprout.svg", score: 24 },
  { level: 3, id: "leaf", label: "잎사귀", color: "#68c56f", img: "assets/item-3-leaf.svg", score: 52 },
  { level: 4, id: "flower", label: "꽃다발", color: "#ff8aa0", img: "assets/item-4-flower.svg", score: 110 },
  { level: 5, id: "jar", label: "꿀병", color: "#ffb35a", img: "assets/item-5-jar.svg", score: 220 },
  { level: 6, id: "hive", label: "벌집", color: "#f6a64b", img: "assets/item-6-hive.svg", score: 420 },
  { level: 7, id: "garden", label: "정원", color: "#7ed6b2", img: "assets/item-7-garden.svg", score: 760 },
  { level: 8, id: "palace", label: "브라운 하우스", color: "#d69b4e", img: "assets/item-8-palace.svg", score: 1400 },
];
const NEIGHBOR_STEPS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

const boardElement = document.querySelector("#board");
const boardShellElement = document.querySelector("#boardShell");
const resetButton = document.querySelector("#resetButton");
const guideButton = document.querySelector("#guideButton");
const guideModal = document.querySelector("#guideModal");
const guideBackdrop = document.querySelector("#guideBackdrop");
const guideCloseButton = document.querySelector("#guideCloseButton");
const statusTextElement = document.querySelector("#statusText");
const moveCountElement = document.querySelector("#moveCount");
const mergeCountElement = document.querySelector("#mergeCount");
const scoreCountElement = document.querySelector("#scoreCount");
const bestLevelElement = document.querySelector("#bestLevel");
const chargeCountElement = document.querySelector("#chargeCount");
const emptyCountElement = document.querySelector("#emptyCount");
const brownBubbleElement = document.querySelector("#brownBubble");
const villageTrackElement = document.querySelector("#villageTrack");
const brownCharacterElement = document.querySelector(".brown-character");

const positions = buildPositions();
const positionLookup = new Map(positions.map((position) => [position.key, position]));

let layoutMetrics = { cellSize: 56, gap: 5 };
let board = new Map();
let nextItemId = 1;
let selectedKey = null;
let dragState = null;
let inputLocked = false;
let moves = 0;
let merges = 0;
let score = 0;
let highestLevel = 1;
let dispenserKey = key(2, 3);
let audioContext = null;
let noiseBuffer = null;
let stageGrowthCount = 0;
let brownDirectionStart = Date.now();

const VILLAGE_BUILDINGS = [
  { name: "집", icon: "🏠", step: "Step 1", wall: "linear-gradient(180deg, #fff6dd, #f2ce84)", roof: "linear-gradient(180deg, #df8458, #bb5a39)" },
  { name: "카페", icon: "☕", step: "Step 2", wall: "linear-gradient(180deg, #fff1e2, #e9c29a)", roof: "linear-gradient(180deg, #8b5f49, #6e4736)" },
  { name: "편의점", icon: "🛒", step: "Step 3", wall: "linear-gradient(180deg, #f3ffe5, #b8df8d)", roof: "linear-gradient(180deg, #5fcf7c, #349b58)" },
  { name: "빵집", icon: "🥖", step: "Step 4", wall: "linear-gradient(180deg, #fff4d6, #f4cd7c)", roof: "linear-gradient(180deg, #ffb764, #ea8d33)" },
  { name: "꽃집", icon: "🌷", step: "Step 5", wall: "linear-gradient(180deg, #fff1f6, #f5bfd0)", roof: "linear-gradient(180deg, #ff90b0, #e45a82)" },
  { name: "놀이터", icon: "🎠", step: "Step 6", wall: "linear-gradient(180deg, #eef8ff, #b7d8ee)", roof: "linear-gradient(180deg, #6dbdf8, #438ec8)" },
  { name: "공원", icon: "🌳", step: "Step 7", wall: "linear-gradient(180deg, #efffdc, #bce89d)", roof: "linear-gradient(180deg, #6fcb68, #41944a)" },
  { name: "도서관", icon: "📚", step: "Step 8", wall: "linear-gradient(180deg, #fff8e9, #e8d1a8)", roof: "linear-gradient(180deg, #b78d58, #8e6638)" },
  { name: "병원", icon: "🏥", step: "Step 9", wall: "linear-gradient(180deg, #ffffff, #dfeaf5)", roof: "linear-gradient(180deg, #ff8f8f, #d85d5d)" },
  { name: "소방서", icon: "🚒", step: "Step 10", wall: "linear-gradient(180deg, #fff0eb, #efc0b2)", roof: "linear-gradient(180deg, #ff755f, #d64531)" },
  { name: "경찰서", icon: "🚓", step: "Step 11", wall: "linear-gradient(180deg, #edf5ff, #c4d6f4)", roof: "linear-gradient(180deg, #79a8f8, #406ec5)" },
  { name: "학교", icon: "🏫", step: "Step 12", wall: "linear-gradient(180deg, #fff3d7, #f0c68e)", roof: "linear-gradient(180deg, #f08f54, #c96736)" },
];

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

function createItem(level = 1) {
  return {
    id: nextItemId += 1,
    level,
  };
}

function createDispenser() {
  return {
    id: `dispenser-${Date.now()}`,
    kind: "dispenser",
  };
}

function getItemDef(level) {
  return ITEM_DEFS[Math.min(MAX_LEVEL, Math.max(1, level)) - 1];
}

function resetGame() {
  nextItemId = 0;
  board = new Map();
  selectedKey = null;
  dragState = null;
  inputLocked = false;
  moves = 0;
  merges = 0;
  score = 0;
  highestLevel = 1;
  stageGrowthCount = 0;
  brownDirectionStart = Date.now();
  dispenserKey = key(2, 3);
  boardElement.innerHTML = "";
  buildBoardSlots();
  updateBoardGeometry();
  seedInitialItems();
  renderBoard();
  renderVillageTrack();
  updateCounters();
  updateDispenserState();
  updateBrownFacing();
  updateBrownMood("브라운이 머지할 아이템을 기다리고 있어요.");
  statusTextElement.textContent = "아이템을 길게 눌러 빈 칸으로 옮기거나, 같은 단계 아이템 위에 드롭해서 머지하세요.";
}

function buildBoardSlots() {
  positions.forEach((position) => {
    const slot = document.createElement("span");
    slot.className = "grid-slot";
    slot.dataset.key = position.key;
    slot.style.left = `${position.x}px`;
    slot.style.top = `${position.y}px`;
    boardElement.append(slot);
  });
}

function seedInitialItems() {
  const openKeys = positions.map((position) => position.key).filter((nextKey) => nextKey !== dispenserKey);
  const shuffled = [...openKeys].sort(() => Math.random() - 0.5);

  board.set(dispenserKey, createDispenser());
  board.set(shuffled[0], createItem(1));
  board.set(shuffled[1], createItem(1));
  board.set(shuffled[2], createItem(2));
}

function updateBoardGeometry() {
  const shellWidth = boardShellElement.clientWidth || 390;
  const innerWidth = shellWidth - 32;
  const cellSize = Math.max(48, Math.min(60, (innerWidth - 5 * 5) / BOARD_COLS));
  const gap = Math.max(4, Math.min(6, cellSize * 0.1));
  const boardWidth = BOARD_COLS * cellSize + (BOARD_COLS - 1) * gap;
  const boardHeight = BOARD_ROWS * cellSize + (BOARD_ROWS - 1) * gap;

  layoutMetrics = { cellSize, gap };
  document.documentElement.style.setProperty("--cell-size", `${cellSize}px`);
  document.documentElement.style.setProperty("--cell-gap", `${gap}px`);
  document.documentElement.style.setProperty("--board-width", `${boardWidth}px`);
  document.documentElement.style.setProperty("--board-height", `${boardHeight}px`);

  positions.forEach((position) => {
    position.x = position.col * (cellSize + gap);
    position.y = position.row * (cellSize + gap);
  });

  boardElement.querySelectorAll(".grid-slot").forEach((slot) => {
    const position = positionLookup.get(slot.dataset.key);
    slot.style.left = `${position.x}px`;
    slot.style.top = `${position.y}px`;
  });

  renderBoard();
}

function renderBoard() {
  const liveIds = new Set();

  positions.forEach((position) => {
    const item = board.get(position.key);
    if (!item) return;

    liveIds.add(String(item.id));
    const element = getOrCreateItemElement(item, position.key);
    const isDispenser = item.kind === "dispenser";
    const def = isDispenser ? null : getItemDef(item.level);
    const image = element.querySelector("img");

    image.src = isDispenser ? "assets/dispenser.svg" : def.img;
    element.style.setProperty("--item-color", isDispenser ? "#ffd071" : def.color);
    element.style.setProperty("--x", `${position.x}px`);
    element.style.setProperty("--y", `${position.y}px`);
    element.dataset.key = position.key;
    element.classList.toggle("dispenser", isDispenser);
    element.classList.toggle("selected", selectedKey === position.key);
    element.setAttribute("aria-label", isDispenser ? "화수분" : `${def.label} 아이템`);
  });

  boardElement.querySelectorAll(".item").forEach((element) => {
    if (!liveIds.has(element.dataset.id)) {
      element.remove();
    }
  });
}

function renderVillageTrack(newIndex = -1) {
  if (!villageTrackElement) return;

  villageTrackElement.innerHTML = "";

  VILLAGE_BUILDINGS.forEach((building, index) => {
    const lot = document.createElement("div");
    lot.className = "village-lot";

    if (index < stageGrowthCount) {
      const card = document.createElement("div");
      card.className = "village-building";
      if (index === newIndex) {
        card.classList.add("unlocked-new");
      }
      card.style.setProperty("--building-wall", building.wall);
      card.style.setProperty("--building-roof", building.roof);

      const icon = document.createElement("span");
      icon.className = "village-icon";
      icon.textContent = building.icon;

      const windows = document.createElement("div");
      windows.className = "village-windows";
      for (let count = 0; count < 4; count += 1) {
        const windowPane = document.createElement("span");
        windowPane.className = "village-window";
        windows.append(windowPane);
      }

      const label = document.createElement("div");
      label.className = "village-label";
      const name = document.createElement("span");
      name.className = "village-name";
      name.textContent = building.name;
      const step = document.createElement("span");
      step.className = "village-step";
      step.textContent = building.step;
      label.append(name, step);

      card.append(icon, windows, label);
      lot.append(card);
    } else {
      const empty = document.createElement("div");
      empty.className = "village-empty";
      lot.append(empty);
    }

    villageTrackElement.append(lot);
  });

  const focusIndex = Math.max(0, stageGrowthCount - 1);
  const shift = Math.max(0, focusIndex - 2) * 128;
  villageTrackElement.style.transform = `translateX(${-shift}px)`;
}

function getOrCreateItemElement(item, boardKey) {
  const existing = boardElement.querySelector(`.item[data-id="${item.id}"]`);
  if (existing) return existing;

  const element = document.createElement("button");
  element.className = "item";
  element.type = "button";
  element.dataset.id = String(item.id);
  element.dataset.key = boardKey;

  const image = document.createElement("img");
  image.alt = "";
  element.append(image);

  element.addEventListener("pointerdown", (event) => {
    startDrag(event, item.id);
  });

  boardElement.append(element);
  return element;
}

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
  const [originKey] = entry;
  const element = boardElement.querySelector(`.item[data-id="${itemId}"]`);
  const boardRect = boardElement.getBoundingClientRect();
  const position = positionLookup.get(originKey);

  selectedKey = originKey;
  dragState = {
    itemId,
    originKey,
    element,
    boardRect,
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    offsetX: event.clientX - (boardRect.left + position.x + layoutMetrics.cellSize / 2),
    offsetY: event.clientY - (boardRect.top + position.y + layoutMetrics.cellSize / 2),
    targetKey: originKey,
    moved: false,
  };

  element.setPointerCapture?.(event.pointerId);
  element.addEventListener("pointermove", handleDragMove);
  element.addEventListener("pointerup", handleDragEnd);
  element.addEventListener("pointercancel", handleDragEnd);
  renderBoard();
}

function handleDragMove(event) {
  if (!dragState) return;

  const moveDistance = Math.hypot(event.clientX - dragState.startClientX, event.clientY - dragState.startClientY);
  if (moveDistance > 8 && !dragState.moved) {
    dragState.moved = true;
    dragState.element.classList.add("dragging");
  }

  if (!dragState.moved) {
    return;
  }

  const x = event.clientX - dragState.boardRect.left - layoutMetrics.cellSize / 2 - dragState.offsetX;
  const y = event.clientY - dragState.boardRect.top - layoutMetrics.cellSize / 2 - dragState.offsetY;
  dragState.element.style.setProperty("--x", `${x}px`);
  dragState.element.style.setProperty("--y", `${y}px`);

  const targetKey = findClosestKey(event.clientX, event.clientY);
  dragState.targetKey = targetKey;
  highlightDropTarget(targetKey);
}

function handleDragEnd() {
  if (!dragState) return;

  const { originKey, targetKey, element, moved } = dragState;
  clearDropTargetHighlights();
  element.classList.remove("dragging");
  element.removeEventListener("pointermove", handleDragMove);
  element.removeEventListener("pointerup", handleDragEnd);
  element.removeEventListener("pointercancel", handleDragEnd);
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
  const rect = boardElement.getBoundingClientRect();
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  let bestKey = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  positions.forEach((position) => {
    const centerX = position.x + layoutMetrics.cellSize / 2;
    const centerY = position.y + layoutMetrics.cellSize / 2;
    const distance = Math.hypot(localX - centerX, localY - centerY);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestKey = position.key;
    }
  });

  return bestDistance <= layoutMetrics.cellSize * 0.72 ? bestKey : null;
}

async function commitMove(originKey, targetKey) {
  renderBoard();
  if (inputLocked) return;

  const originItem = board.get(originKey);
  if (!originItem) {
    selectedKey = null;
    renderBoard();
    return;
  }

  if (!targetKey || originKey === targetKey) {
    selectedKey = originKey;
    renderBoard();
    return;
  }

  inputLocked = true;

  try {
    const targetItem = board.get(targetKey);

    if (!targetItem) {
      board.delete(originKey);
      board.set(targetKey, originItem);
      if (originItem.kind === "dispenser") {
        dispenserKey = targetKey;
      }
      moves += 1;
      playMoveSound();
      statusTextElement.textContent = "아이템을 이동했어요.";
      updateCounters();
      updateDispenserState();
      updateBrownMood("브라운이 자리를 잘 잡았다고 고개를 끄덕였어요.");
    } else if (
      originItem.kind !== "dispenser" &&
      targetItem.kind !== "dispenser" &&
      targetItem.level === originItem.level &&
      targetItem.level < MAX_LEVEL
    ) {
      await animateMerge(originKey, targetKey, targetItem.level);
      board.delete(originKey);
      board.set(targetKey, createItem(targetItem.level + 1));
      moves += 1;
      merges += 1;
      const mergedDef = getItemDef(targetItem.level + 1);
      score += mergedDef.score;
      const previousHighestLevel = highestLevel;
      highestLevel = Math.max(highestLevel, mergedDef.level);
      if (highestLevel > previousHighestLevel || stageGrowthCount < VILLAGE_BUILDINGS.length) {
        stageGrowthCount = Math.min(VILLAGE_BUILDINGS.length, stageGrowthCount + 1);
        renderVillageTrack(stageGrowthCount - 1);
      }
      playMergeSound(mergedDef.level);
      statusTextElement.textContent = `${mergedDef.label}로 머지됐어요.`;
      updateCounters();
      updateDispenserState();
      updateBrownMood(`${mergedDef.label}까지 올라가자 브라운이 신나게 움직였어요.`);
    } else {
      playRejectSound();
      statusTextElement.textContent =
        originItem.kind === "dispenser"
          ? "화수분은 다른 아이템과 머지되지 않아요."
          : "같은 단계 아이템끼리만 머지할 수 있어요.";
      selectedKey = originKey;
      renderBoard();
      return;
    }

    selectedKey = null;
    renderBoard();

    if (countEmptySlots() === 0) {
      updateBrownMood("보드가 가득 찼어요. 머지로 공간을 다시 만들어야 해요.");
      statusTextElement.textContent = "빈 칸이 없어요. 낮은 단계 아이템부터 합쳐 공간을 만들어 주세요.";
    }
  } finally {
    inputLocked = false;
  }
}

async function animateMerge(originKey, targetKey, level) {
  const originCenter = getBoardCenter(originKey);
  const targetCenter = getBoardCenter(targetKey);
  const def = getItemDef(level);
  const deltaX = targetCenter.x - originCenter.x;
  const deltaY = targetCenter.y - originCenter.y;
  const originElement = boardElement.querySelector(`.item[data-key="${originKey}"]`);
  const targetElement = boardElement.querySelector(`.item[data-key="${targetKey}"]`);

  originElement?.classList.add("merging");
  targetElement?.classList.add("selected");

  const beam = document.createElement("span");
  beam.className = "merge-beam";
  beam.style.setProperty("--beam-x", `${originCenter.x}px`);
  beam.style.setProperty("--beam-y", `${originCenter.y}px`);
  beam.style.setProperty("--beam-length", `${Math.hypot(deltaX, deltaY)}px`);
  beam.style.setProperty("--beam-angle", `${Math.atan2(deltaY, deltaX)}rad`);
  beam.style.setProperty("--beam-color", def.color);
  boardElement.append(beam);
  beam.addEventListener("animationend", () => beam.remove(), { once: true });

  const core = document.createElement("span");
  core.className = "merge-core";
  core.style.left = `${targetCenter.x}px`;
  core.style.top = `${targetCenter.y}px`;
  boardElement.append(core);
  core.addEventListener("animationend", () => core.remove(), { once: true });

  const ring = document.createElement("span");
  ring.className = "merge-ring";
  ring.style.left = `${targetCenter.x}px`;
  ring.style.top = `${targetCenter.y}px`;
  ring.style.setProperty("--ring-color", def.color);
  boardElement.append(ring);
  ring.addEventListener("animationend", () => ring.remove(), { once: true });

  for (let index = 0; index < 8; index += 1) {
    const angle = (Math.PI * 2 * index) / 8;
    const particle = document.createElement("span");
    particle.className = "merge-particle";
    particle.style.left = `${targetCenter.x}px`;
    particle.style.top = `${targetCenter.y}px`;
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
    statusTextElement.textContent = "화수분 주변에 빈 칸이 없어요.";
    updateBrownMood("브라운이 먼저 주변 공간부터 정리하자고 손짓했어요.");
    return;
  }

  inputLocked = true;

  try {
    playDispenserSound();
    const spawnCount = Math.min(Math.random() < 0.55 ? 1 : 2, emptyKeys.length);
    const chosen = [...emptyKeys].sort(() => Math.random() - 0.5).slice(0, spawnCount);
    const spawnedEntries = chosen.map((nextKey) => {
      const level = Math.random() < 0.14 && highestLevel >= 2 ? 2 : 1;
      const item = createItem(level);
      board.set(nextKey, item);
      highestLevel = Math.max(highestLevel, level);
      return { key: nextKey, item };
    });

    renderBoard();
    await animateSpawnItems(spawnedEntries);
    updateCounters();
    updateDispenserState();
    updateBrownMood("브라운이 화수분에서 반짝이는 아이템이 나오는 걸 지켜보고 있어요.");
    statusTextElement.textContent = `화수분에서 아이템 ${spawnCount}개가 나왔어요.`;
  } finally {
    inputLocked = false;
  }
}

function getAdjacentEmptyKeys(boardKey) {
  const position = positionLookup.get(boardKey);
  if (!position) return [];

  return NEIGHBOR_STEPS
    .map(([colStep, rowStep]) => key(position.col + colStep, position.row + rowStep))
    .filter((nextKey) => positionLookup.has(nextKey) && !board.has(nextKey));
}

async function animateSpawnItems(entries) {
  const origin = getBoardCenter(dispenserKey);

  entries.forEach(({ key: nextKey, item }, index) => {
    const center = getBoardCenter(nextKey);
    const drop = document.createElement("span");
    drop.className = "spawn-drop";
    drop.style.setProperty("--start-x", `${origin.x}px`);
    drop.style.setProperty("--start-y", `${origin.y}px`);
    drop.style.setProperty("--fly-x", `${center.x - origin.x}px`);
    drop.style.setProperty("--fly-y", `${center.y - origin.y}px`);
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

function getBoardCenter(boardKey) {
  const position = positionLookup.get(boardKey);
  return {
    x: position.x + layoutMetrics.cellSize / 2,
    y: position.y + layoutMetrics.cellSize / 2,
  };
}

function updateCounters() {
  moveCountElement.textContent = String(moves);
  mergeCountElement.textContent = String(merges);
  scoreCountElement.textContent = String(score);
  bestLevelElement.textContent = `${highestLevel}단계`;
  emptyCountElement.textContent = String(countEmptySlots());
}

function countEmptySlots() {
  return positions.length - board.size;
}

function updateDispenserState() {
  chargeCountElement.textContent = "사용 가능";
}

function updateBrownMood(message) {
  brownBubbleElement.textContent = message;
}

function updateBrownFacing() {
  if (!brownCharacterElement) return;

  const cycle = 7800;
  const phase = ((Date.now() - brownDirectionStart) % cycle) / cycle;
  const facingRight = phase < 0.62;

  brownCharacterElement.classList.toggle("facing-right", facingRight);
  brownCharacterElement.classList.toggle("facing-left", !facingRight);
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function resumeAudio() {
  const context = getAudioContext();
  if (!context) return;
  if (context.state === "suspended") {
    try {
      await context.resume();
    } catch (error) {
      console.warn(error);
    }
  }
}

function getAudioContext() {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  if (!audioContext) {
    audioContext = new AudioCtor();
  }
  return audioContext;
}

function getNoiseBuffer() {
  const context = getAudioContext();
  if (!context) return null;
  if (noiseBuffer) return noiseBuffer;

  noiseBuffer = context.createBuffer(1, context.sampleRate * 0.6, context.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

function playTone({ frequency, duration = 0.12, type = "triangle", gain = 0.05, when = 0, attack = 0.01, release = 0.12 }) {
  const context = getAudioContext();
  if (!context) return;

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const startTime = context.currentTime + when;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.linearRampToValueAtTime(gain, startTime + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration + release);
  oscillator.connect(gainNode).connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + release + 0.02);
}

function playNoise({ duration = 0.14, gain = 0.02, frequency = 1200, when = 0 }) {
  const context = getAudioContext();
  const buffer = getNoiseBuffer();
  if (!context || !buffer) return;

  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gainNode = context.createGain();
  const startTime = context.currentTime + when;
  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(frequency, startTime);
  gainNode.gain.setValueAtTime(gain, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  source.connect(filter).connect(gainNode).connect(context.destination);
  source.start(startTime);
  source.stop(startTime + duration + 0.02);
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
  playTone({ frequency: base, duration: 0.09, gain: 0.05 });
  playTone({ frequency: base * 1.26, duration: 0.12, gain: 0.045, when: 0.07 });
  playTone({ frequency: base * 1.6, duration: 0.15, type: "sine", gain: 0.04, when: 0.14 });
  playNoise({ duration: 0.16, gain: 0.016, frequency: 1500 + level * 60, when: 0.02 });
}

function playDispenserSound() {
  playTone({ frequency: 360, duration: 0.12, gain: 0.045 });
  playTone({ frequency: 520, duration: 0.12, gain: 0.04, when: 0.08 });
  playTone({ frequency: 720, duration: 0.14, type: "sine", gain: 0.035, when: 0.16 });
}

function playRejectSound() {
  playTone({ frequency: 280, duration: 0.08, type: "sawtooth", gain: 0.02 });
  playTone({ frequency: 220, duration: 0.08, type: "sawtooth", gain: 0.015, when: 0.08 });
}

function openGuideModal() {
  guideModal?.removeAttribute("hidden");
}

function closeGuideModal() {
  guideModal?.setAttribute("hidden", "");
}

window.addEventListener("resize", updateBoardGeometry);
resetButton.addEventListener("click", resetGame);
guideButton?.addEventListener("click", openGuideModal);
guideCloseButton?.addEventListener("click", closeGuideModal);
guideBackdrop?.addEventListener("click", closeGuideModal);
window.setInterval(updateBrownFacing, 120);

resetGame();

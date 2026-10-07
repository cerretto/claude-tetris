'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// ---- Skins ----
// Each skin's `colors` is aligned with PIECES: index 0 = empty, 1..7 = I,O,T,S,Z,J,L.
// `drawBlock` paints one cell; globalAlpha (ghost piece) is set by the caller.
function shadeColor(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const mix = v => Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount);
  const r = mix(n >> 16), g = mix((n >> 8) & 0xff), b = mix(n & 0xff);
  return `rgb(${r},${g},${b})`;
}

function roundedRectPath(context, x, y, w, h, radius) {
  context.beginPath();
  if (typeof context.roundRect === 'function') {
    context.roundRect(x, y, w, h, radius);
    return;
  }
  context.moveTo(x + radius, y);
  context.lineTo(x + w - radius, y);
  context.quadraticCurveTo(x + w, y, x + w, y + radius);
  context.lineTo(x + w, y + h - radius);
  context.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  context.lineTo(x + radius, y + h);
  context.quadraticCurveTo(x, y + h, x, y + h - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

const SKINS = {
  retro: {
    name: 'Retro',
    colors: [
      null,
      '#4dd0e1', // I - cyan
      '#ffd54f', // O - yellow
      '#ba68c8', // T - purple
      '#81c784', // S - green
      '#e57373', // Z - red
      '#64b5f6', // J - pale blue
      '#ffb74d', // L - orange
    ],
    boardBg: '#1a1a25',
    gridColor: '#22222e',
    drawBlock(context, x, y, colorIndex, size) {
      context.fillStyle = this.colors[colorIndex];
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      // highlight
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    },
  },
  neon: {
    name: 'Neón',
    colors: [null, '#00f0ff', '#fff200', '#d400ff', '#39ff14', '#ff073a', '#2d6bff', '#ff8c00'],
    boardBg: '#000000',
    gridColor: '#0d0d14',
    drawBlock(context, x, y, colorIndex, size) {
      const color = this.colors[colorIndex];
      const px = x * size + 3, py = y * size + 3, s = size - 6;
      context.shadowColor = color;
      context.shadowBlur = 12;
      context.fillStyle = shadeColor(color, -0.75);
      context.fillRect(px, py, s, s);
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.strokeRect(px, py, s, s);
      context.shadowBlur = 0;
      context.shadowColor = 'transparent';
    },
  },
  pastel: {
    name: 'Pastel',
    colors: [null, '#a8e6f0', '#fdf1a8', '#d9c2f0', '#bfe8c4', '#f6b8c0', '#b8d4f6', '#fcd2a8'],
    boardBg: '#2b2838',
    gridColor: '#353247',
    drawBlock(context, x, y, colorIndex, size) {
      const px = x * size + 2, py = y * size + 2, s = size - 4;
      roundedRectPath(context, px, py, s, s, s * 0.25);
      context.fillStyle = this.colors[colorIndex];
      context.fill();
      roundedRectPath(context, px + 3, py + 3, s - 6, s * 0.3, s * 0.12);
      context.fillStyle = 'rgba(255,255,255,0.35)';
      context.fill();
    },
  },
  pixel: {
    name: 'Pixel art',
    colors: [null, '#2ce8f5', '#fee761', '#b55088', '#63c74d', '#e43b44', '#0099db', '#f77622'],
    boardBg: '#181425',
    gridColor: '#262b44',
    drawBlock(context, x, y, colorIndex, size) {
      const color = this.colors[colorIndex];
      const light = shadeColor(color, 0.45);
      const dark = shadeColor(color, -0.4);
      const n = 6; // texture resolution: n × n "pixels" per block
      const p = size / n;
      const ox = x * size, oy = y * size;
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          let tone = color;
          if (r === 0 || c === 0) tone = light;                 // top/left bevel
          else if (r === n - 1 || c === n - 1) tone = dark;     // bottom/right bevel
          else if ((r + c) % 4 === 0) tone = shadeColor(color, -0.15); // inner dither
          context.fillStyle = tone;
          context.fillRect(Math.floor(ox + c * p), Math.floor(oy + r * p), Math.ceil(p), Math.ceil(p));
        }
      }
    },
  },
};

const DEFAULT_SKIN = 'retro';
const SKIN_STORAGE_KEY = 'tetris.skin';
let activeSkin = SKINS[DEFAULT_SKIN];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  updateCombo(cleared);
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = gameStartLevel + Math.floor(lines / 10);
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  context.save();
  context.globalAlpha = alpha ?? 1;
  activeSkin.drawBlock(context, x, y, colorIndex, size, alpha);
  context.restore();
}

function drawGrid() {
  ctx.strokeStyle = activeSkin.gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.fillStyle = activeSkin.boardBg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.fillStyle = activeSkin.boardBg;
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  showGameOverRecords();
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    hidePauseMenu();
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    showPauseMenu();
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  gameStartLevel = startLevel;
  level = startLevel;
  combo = 0;
  maxCombo = 0;
  resetHighScoreUI();
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  hidePauseMenu();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

// ---- Pause menu ----
const pauseMenu = document.getElementById('pause-menu');
const resumeBtn = document.getElementById('resume-btn');
const menuRestartBtn = document.getElementById('menu-restart-btn');
const controlsToggleBtn = document.getElementById('controls-toggle-btn');
const pauseControls = document.getElementById('pause-controls');
const startLevelSelect = document.getElementById('start-level-select');

const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyX'];

// Level chosen in the menu; applied by init() on the next game.
let startLevel = 1;
// Level the current game started at; clearLines() levels up from here.
let gameStartLevel = 1;

function showPauseMenu() {
  pauseMenu.classList.remove('hidden');
}

function hidePauseMenu() {
  pauseMenu.classList.add('hidden');
  // Drop focus from menu controls so later keys (Space, arrows) don't re-trigger them.
  if (pauseMenu.contains(document.activeElement)) document.activeElement.blur();
}

function setControlsExpanded(expanded) {
  pauseControls.classList.toggle('hidden', !expanded);
  controlsToggleBtn.setAttribute('aria-expanded', String(expanded));
  controlsToggleBtn.textContent = expanded ? 'Ocultar controles' : 'Ver controles';
}

resumeBtn.addEventListener('click', () => {
  if (paused) togglePause();
});

menuRestartBtn.addEventListener('click', () => {
  init();
});

controlsToggleBtn.addEventListener('click', () => {
  setControlsExpanded(pauseControls.classList.contains('hidden'));
  controlsToggleBtn.blur();
});

startLevelSelect.addEventListener('change', () => {
  const value = parseInt(startLevelSelect.value, 10);
  startLevel = Math.min(10, Math.max(1, Number.isNaN(value) ? 1 : value));
});

// ---- High scores ----
// Top-5 table persisted in localStorage. Historical bests (combo / lines) are
// stored separately so they survive even when a game does not reach the top 5.

const HS_KEY = 'tetris.highscores';
const HS_STATS_KEY = 'tetris.stats';
const HS_MAX = 5;
const HS_NAME_MAX = 12;
const HS_DEFAULT_NAME = 'Anónimo';

const startScreen = document.getElementById('start-screen');
const playBtn = document.getElementById('play-btn');
const clearHsBtn = document.getElementById('clear-hs-btn');
const startHsTable = document.getElementById('start-hs-table');
const startHsStats = document.getElementById('start-hs-stats');
const gameoverRecords = document.getElementById('gameover-records');
const gameoverHsTable = document.getElementById('gameover-hs-table');
const gameoverHsStats = document.getElementById('gameover-hs-stats');
const hsNewRecord = document.getElementById('hs-new-record');
const hsEntry = document.getElementById('hs-entry');
const hsName = document.getElementById('hs-name');

// combo: consecutive locked pieces that each cleared >= 1 line.
let combo = 0;
let maxCombo = 0;
// Score waiting to be saved with a player name (null when nothing pending).
let pendingEntry = null;
// In-memory copies, so the UI keeps working when storage is unavailable.
let highScores = loadHighScores();
let hsStats = loadStats();

function updateCombo(cleared) {
  if (cleared) {
    combo++;
    maxCombo = Math.max(maxCombo, combo);
  } else {
    combo = 0;
  }
}

function toCount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function sanitizeName(value) {
  const name = String(value ?? '').trim().slice(0, HS_NAME_MAX);
  return name || HS_DEFAULT_NAME;
}

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: keep the in-memory copy only.
  }
}

function removeKey(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore: in-memory state is cleared anyway.
  }
}

function loadHighScores() {
  const data = readJSON(HS_KEY);
  if (!Array.isArray(data)) return [];
  return data
    .filter(e => e && typeof e === 'object' && toCount(e.score) > 0)
    .map(e => ({
      name: sanitizeName(e.name),
      score: toCount(e.score),
      lines: toCount(e.lines),
      maxCombo: toCount(e.maxCombo),
      date: typeof e.date === 'string' ? e.date : '',
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, HS_MAX);
}

function loadStats() {
  const data = readJSON(HS_STATS_KEY);
  const fromTable = highScores.reduce(
    (acc, e) => ({ bestCombo: Math.max(acc.bestCombo, e.maxCombo), maxLines: Math.max(acc.maxLines, e.lines) }),
    { bestCombo: 0, maxLines: 0 }
  );
  return {
    bestCombo: Math.max(toCount(data?.bestCombo), fromTable.bestCombo),
    maxLines: Math.max(toCount(data?.maxLines), fromTable.maxLines),
  };
}

// Index the score would occupy in the table, or -1 if it does not qualify.
function highScoreRank(value) {
  if (value <= 0) return -1;
  const idx = highScores.findIndex(e => value > e.score);
  if (idx !== -1) return idx;
  return highScores.length < HS_MAX ? highScores.length : -1;
}

function formatDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '-' : d.toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function renderTable(table, highlight) {
  table.replaceChildren();
  const head = table.createTHead().insertRow();
  for (const label of ['#', 'Nombre', 'Puntos', 'Líneas', 'Combo', 'Fecha']) {
    const th = document.createElement('th');
    th.textContent = label;
    if (label === 'Nombre') th.className = 'hs-name';
    head.appendChild(th);
  }
  const body = table.createTBody();
  if (!highScores.length) {
    const cell = body.insertRow().insertCell();
    cell.colSpan = 6;
    cell.className = 'hs-empty';
    cell.textContent = 'Sin récords todavía';
    return;
  }
  highScores.forEach((e, i) => {
    const row = body.insertRow();
    if (e === highlight) row.className = 'hs-highlight';
    const values = [i + 1, e.name, e.score.toLocaleString(), e.lines, e.maxCombo, formatDate(e.date)];
    values.forEach((v, col) => {
      const cell = row.insertCell();
      if (col === 1) cell.className = 'hs-name';
      cell.textContent = v; // textContent: player names are never parsed as HTML
    });
  });
}

function renderStats(el) {
  el.textContent = `Mejor combo: ${hsStats.bestCombo} · Líneas máx.: ${hsStats.maxLines}`;
}

function renderStartScreen() {
  renderTable(startHsTable, null);
  renderStats(startHsStats);
}

function renderGameOverRecords(highlight) {
  renderTable(gameoverHsTable, highlight);
  renderStats(gameoverHsStats);
}

function recordGameStats() {
  hsStats = {
    bestCombo: Math.max(hsStats.bestCombo, maxCombo),
    maxLines: Math.max(hsStats.maxLines, lines),
  };
  writeJSON(HS_STATS_KEY, hsStats);
}

function showGameOverRecords() {
  recordGameStats();
  const rank = highScoreRank(score);
  pendingEntry = rank === -1 ? null : { score, lines, maxCombo, date: new Date().toISOString() };
  if (pendingEntry) {
    hsNewRecord.textContent = `¡Nuevo récord! Entras en el top ${HS_MAX} (puesto ${rank + 1})`;
    hsNewRecord.classList.remove('hidden');
    hsName.value = '';
    hsEntry.classList.remove('hidden');
  }
  renderGameOverRecords(null);
  gameoverRecords.classList.remove('hidden');
  if (pendingEntry) hsName.focus();
}

function saveHighScore() {
  if (!pendingEntry) return;
  const entry = { name: sanitizeName(hsName.value), ...pendingEntry };
  pendingEntry = null;
  highScores = [...highScores, entry].sort((a, b) => b.score - a.score).slice(0, HS_MAX);
  writeJSON(HS_KEY, highScores);
  hsName.blur();
  hsEntry.classList.add('hidden');
  hsNewRecord.textContent = `¡Récord guardado! Puesto ${highScores.indexOf(entry) + 1}`;
  renderGameOverRecords(entry);
}

function resetHighScoreUI() {
  pendingEntry = null;
  // Drop focus from Jugar/Reiniciar so Space/Enter during play can't re-click them.
  if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
  startScreen.classList.add('hidden');
  gameoverRecords.classList.add('hidden');
  hsEntry.classList.add('hidden');
  hsNewRecord.classList.add('hidden');
}

function clearHighScores() {
  if (!confirm('¿Borrar todos los récords? Esta acción no se puede deshacer.')) return;
  highScores = [];
  hsStats = { bestCombo: 0, maxLines: 0 };
  removeKey(HS_KEY);
  removeKey(HS_STATS_KEY);
  renderStartScreen();
}

function isTypingTarget(target) {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

hsEntry.addEventListener('submit', e => {
  e.preventDefault();
  saveHighScore();
});
playBtn.addEventListener('click', init);
clearHsBtn.addEventListener('click', clearHighScores);

document.addEventListener('keydown', e => {
  // Ignore input before the first game.
  if (!startScreen.classList.contains('hidden')) return;
  // Let form fields (e.g. the high-score name) receive keys; pause-menu controls still handle P/Esc below.
  if (isTypingTarget(e.target) && !pauseMenu.contains(e.target)) return;
  if (e.code === 'KeyP' || e.code === 'Escape') {
    e.preventDefault();
    if (!e.repeat) togglePause();
    return;
  }
  if (paused || gameOver) {
    // Let focused menu controls keep native Space/Enter/arrow behavior; otherwise swallow game keys.
    if (paused && GAME_KEYS.includes(e.code) && !pauseMenu.contains(e.target)) e.preventDefault();
    return;
  }
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

// ---- Skins ----
const skinSelect = document.getElementById('skin-select');

function loadSkinKey() {
  try {
    const saved = localStorage.getItem(SKIN_STORAGE_KEY);
    if (saved && Object.hasOwn(SKINS, saved)) return saved;
  } catch (_) { /* storage unavailable */ }
  return DEFAULT_SKIN;
}

function applySkin(key) {
  if (!Object.hasOwn(SKINS, key)) key = DEFAULT_SKIN;
  activeSkin = SKINS[key];
  skinSelect.value = key;
  // Redraw immediately: the loop may be stopped (pause / game over).
  if (current) draw();
  if (next) drawNext();
}

for (const [key, skin] of Object.entries(SKINS)) {
  skinSelect.add(new Option(skin.name, key));
}

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  try { localStorage.setItem(SKIN_STORAGE_KEY, skinSelect.value); } catch (_) { /* ignore */ }
  skinSelect.blur(); // return keyboard focus to the game
});

// While the select is focused, keep game keys from also reaching the game.
skinSelect.addEventListener('keydown', e => {
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.stopPropagation();
});

applySkin(loadSkinKey());

// The game no longer auto-starts: show the start screen with the records table.
drawGrid();
renderStartScreen();

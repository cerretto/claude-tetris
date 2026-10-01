# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language

- Converse with the user in Spanish.
- Keep this `CLAUDE.md` in English.

## Project

Classic Tetris in vanilla JavaScript + HTML5 Canvas + CSS. No dependencies, no `package.json`, no build step, no tests, no linter.

## Running

Open `index.html` directly, or serve the folder statically (preferred):

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Architecture

Three files: `index.html` (DOM + two canvases + overlay), `style.css` (dark theme), `game.js` (all logic). `game.js` is a single classic script (not an ES module) with `'use strict'` and module-level mutable state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropAccum`, `dropInterval`, `animId`), all (re)initialized in `init()`.

Key invariants that span multiple places:

- **One number encodes piece type, cell value, and color.** `PIECES[i]` shapes contain the value `i`, locked cells in `board` store that same value, and `COLORS[i]` renders it. Index `0`/`null` means empty. Adding or reordering pieces requires keeping `PIECES`, `COLORS`, and `randomPiece()` (`Math.random() * 7 + 1`) in sync.
- **Canvas size is coupled to constants.** `<canvas id="board">` in `index.html` must be `COLS × BLOCK` by `ROWS × BLOCK`. `drawNext()` assumes a 4×4 grid of 30px cells, matching the 120×120 `#next-canvas`.
- **Game loop:** `requestAnimationFrame(loop)` accumulates `dt` into `dropAccum`; when it exceeds `dropInterval` the piece falls or `lockPiece()` runs (`merge` → `clearLines` → `spawn`). Game over is detected in `spawn()` when the new piece collides immediately.
- **Pause / game over** stop the loop via `cancelAnimationFrame(animId)`; resuming calls `loop()` again after resetting `lastTime`. The `keydown` handler ignores input while `paused || gameOver`, except `KeyP`.
- **Collision** (`collide`) allows cells with negative `y` (above the board) but rejects out-of-bounds `x` and `y >= ROWS`. Rotation (`tryRotate`) is `rotateCW` plus simple horizontal kicks `[0, -1, 1, -2, 2]` — not SRS.
- **Scoring/levels:** `LINE_SCORES[cleared] * level`; hard drop +2/row, soft drop +1/row; `level = floor(lines / 10) + 1`; `dropInterval = max(100, 1000 - (level - 1) * 90)`.

## Conventions

- User-facing UI text and the README are in Spanish (`lang="es"`, e.g. "PAUSA", "Reiniciar", "Puntuación"); code identifiers and comments are in English.
- Controls are documented in three places — the `keydown` handler, the controls list in `index.html`, and the README table. Keep them consistent.

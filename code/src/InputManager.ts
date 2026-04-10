// ============================================================
// ELEMENTRIS - 
// Virtual D-pad (left/right/up=hard-drop/down=soft-drop) on bottom-left.
// Rotate button on bottom-right.
// Touch-and-hold DAS for left/right/down.
// Skill panel taps on right side.
// Level-up card selection overlay.
// ============================================================

import { GameController } from './GameController';
import { GameState } from './types';
import {
  BOARD_TOP, ROWS, CELL_SIZE,
  ELEMENT_TYPES, SKILL_PANEL_W,
  BOARD_LEFT, COLS, PATH_WIDTH,
} from './constants';
import {
  hitDpadBtn, isInRotateBtn,
  SKILL_PANEL_X,
  getLevelUpCardRect,
} from './layout';

// DAS (Delayed Auto Shift) timing constants
const DAS_DELAY_MS   = 150;   // hold duration before repeat starts
const DAS_REPEAT_MS  = 50;    // repeat interval while held

type DpadDir = 'left' | 'right' | 'up' | 'down';

export class InputManager {
  private _gc: GameController;
  private _canvas: HTMLCanvasElement;

  // D-pad hold state
  private _heldDir: DpadDir | null = null;
  private _holdStart: number = 0;
  private _lastRepeat: number = 0;

  constructor(gc: GameController, canvas: HTMLCanvasElement) {
    this._gc = gc;
    this._canvas = canvas;
    this._bind();
  }

  private _bind(): void {
    this._canvas.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: false });
    this._canvas.addEventListener('touchend',   this._onTouchEnd.bind(this),   { passive: false });
    this._canvas.addEventListener('touchmove',  this._onTouchMove.bind(this),  { passive: false });
    this._canvas.addEventListener('mousedown',  this._onMouseDown.bind(this));
    this._canvas.addEventListener('mouseup',    this._onMouseUp.bind(this));
  }

  private _toCanvas(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this._canvas.getBoundingClientRect();
    const scaleX = this._canvas.width  / rect.width;
    const scaleY = this._canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top)  * scaleY,
    };
  }

  // ---- Touch events -----------------------------------------

  private _onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    const t = e.changedTouches[0];
    this._handlePress(t.clientX, t.clientY);
  }

  private _onTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    const { x, y } = this._toCanvas(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    this._handleRelease(x, y);
  }

  private _onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (!this._heldDir) return;
    const { x, y } = this._toCanvas(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    const newDir = hitDpadBtn(x, y);
    if (newDir && newDir !== this._heldDir) {
      this._gc.setSoftDrop(false);
      this._heldDir = newDir;
      this._holdStart = performance.now();
      this._lastRepeat = performance.now();
      this._executeDpad(newDir);
    }
  }

  // ---- Mouse events -----------------------------------------

  private _onMouseDown(e: MouseEvent): void {
    this._handlePress(e.clientX, e.clientY);
  }

  private _onMouseUp(e: MouseEvent): void {
    const { x, y } = this._toCanvas(e.clientX, e.clientY);
    this._handleRelease(x, y);
  }

  // ---- Core logic -------------------------------------------

  private _handlePress(clientX: number, clientY: number): void {
    const { x, y } = this._toCanvas(clientX, clientY);
    const gc = this._gc;

    // ---- Idle / Game Over: start or restart ------------------
    if (gc.state === GameState.IDLE || gc.state === GameState.GAME_OVER) {
      gc.restart();
      return;
    }

    // ---- LEVEL_UP: only skill card selection -----------------
    if (gc.state === GameState.LEVEL_UP) {
      for (let i = 0; i < 3; i++) {
        const r = getLevelUpCardRect(i);
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
          gc.selectPassiveSkill(i);
        }
      }
      return;
    }

    // ---- PLAYING state: check controls ----------------------
    if (gc.state !== GameState.PLAYING) return;

    // Skill panel (right side strip)
    const boardH = ROWS * CELL_SIZE;
    if (x >= SKILL_PANEL_X && x <= SKILL_PANEL_X + SKILL_PANEL_W
        && y >= BOARD_TOP && y <= BOARD_TOP + boardH) {
      const slot = Math.floor((y - BOARD_TOP) / (boardH / ELEMENT_TYPES.length));
      const el = ELEMENT_TYPES[Math.min(slot, ELEMENT_TYPES.length - 1)];
      if (el) gc.useSkill(el);
      return;
    }

    // Rotate button
    if (isInRotateBtn(x, y)) {
      gc.rotate();
      return;
    }

    // D-pad
    const dir = hitDpadBtn(x, y);
    if (dir) {
      this._gc.setSoftDrop(false);
      this._heldDir = dir;
      this._holdStart = performance.now();
      this._lastRepeat = performance.now();
      this._executeDpad(dir);
      return;
    }
  }

  private _handleRelease(_x: number, _y: number): void {
    if (this._heldDir === 'down') {
      this._gc.setSoftDrop(false);
    }
    this._heldDir = null;
  }

  private _executeDpad(dir: DpadDir): void {
    switch (dir) {
      case 'left':  this._gc.moveLeft();  break;
      case 'right': this._gc.moveRight(); break;
      case 'down':  this._gc.setSoftDrop(true); this._gc.softDrop(); break;
      case 'up':    this._heldDir = null; this._gc.hardDrop(); break;
    }
  }

  /** Called from the render loop each frame to process DAS (auto-repeat) */
  update(): void {
    if (!this._heldDir || this._gc.state !== GameState.PLAYING) return;
    if (this._heldDir === 'up') return;   // no repeat for hard drop

    const now = performance.now();
    if (now - this._holdStart < DAS_DELAY_MS) return;

    if (now - this._lastRepeat >= DAS_REPEAT_MS) {
      this._lastRepeat = now;
      switch (this._heldDir) {
        case 'left':  this._gc.moveLeft();  break;
        case 'right': this._gc.moveRight(); break;
        case 'down':  this._gc.softDrop();  break;
      }
    }
  }
}

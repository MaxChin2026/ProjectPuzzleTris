// ============================================================
// ELEMENTRIS — InputManager
// Touch/mouse input: tap slot to select, drag to position, release to drop
// Release/drag back to slot area cancels selection and returns block to slot
// ============================================================

import { GameController } from './GameController';
import { GameState } from './types';
import {
  BOARD_LEFT, BOARD_TOP, CELL_SIZE, COLS, ROWS,
  CANVAS_W, CANVAS_H, SLOT_COUNT,
  PATH_WIDTH, SKILL_PANEL_W, ELEMENT_TYPES,
} from './constants';
import { getSlotRect, SLOT_Y, CANCEL_ZONE_X, CANCEL_ZONE_Y, CANCEL_ZONE_W, CANCEL_ZONE_H } from './layout';

export class InputManager {
  private _gc: GameController;
  private _canvas: HTMLCanvasElement;
  private _dragging: boolean = false;
  private _dragSlotIndex: number = -1;
  private _dragX: number = 0;
  private _dragY: number = 0;

  constructor(gc: GameController, canvas: HTMLCanvasElement) {
    this._gc = gc;
    this._canvas = canvas;
    this._bind();
  }

  private _bind(): void {
    this._canvas.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: false });
    this._canvas.addEventListener('touchmove',  this._onTouchMove.bind(this),  { passive: false });
    this._canvas.addEventListener('touchend',   this._onTouchEnd.bind(this),   { passive: false });
    this._canvas.addEventListener('mousedown',  this._onMouseDown.bind(this));
    this._canvas.addEventListener('mousemove',  this._onMouseMove.bind(this));
    this._canvas.addEventListener('mouseup',    this._onMouseUp.bind(this));
  }

  private _toCanvas(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this._canvas.getBoundingClientRect();
    const scaleX = this._canvas.width / rect.width;
    const scaleY = this._canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  private _onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    const t = e.touches[0];
    this._startInteraction(t.clientX, t.clientY);
  }

  private _onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    const t = e.touches[0];
    this._moveInteraction(t.clientX, t.clientY);
  }

  private _onTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    const t = e.changedTouches[0];
    this._endInteraction(t.clientX, t.clientY);
  }

  private _onMouseDown(e: MouseEvent): void {
    this._startInteraction(e.clientX, e.clientY);
  }

  private _onMouseMove(e: MouseEvent): void {
    if (!this._dragging) return;
    this._moveInteraction(e.clientX, e.clientY);
  }

  private _onMouseUp(e: MouseEvent): void {
    this._endInteraction(e.clientX, e.clientY);
  }

  private _startInteraction(clientX: number, clientY: number): void {
    if (this._gc.state !== GameState.PLAYING) {
      // Allow restart click on game over screen
      if (this._gc.state === GameState.GAME_OVER || this._gc.state === GameState.IDLE) {
        this._gc.restart();
      }
      return;
    }

    const { x, y } = this._toCanvas(clientX, clientY);

    // Check if we tapped a skill icon in the skill panel (right side)
    const skillPanelX = BOARD_LEFT + COLS * CELL_SIZE + PATH_WIDTH;
    const boardH = ROWS * CELL_SIZE;
    if (x >= skillPanelX && x <= skillPanelX + SKILL_PANEL_W
        && y >= BOARD_TOP && y <= BOARD_TOP + boardH) {
      const slot = Math.floor((y - BOARD_TOP) / (boardH / ELEMENT_TYPES.length));
      const el = ELEMENT_TYPES[Math.min(slot, ELEMENT_TYPES.length - 1)];
      if (el) this._gc.useSkill(el);
      return;
    }

    // Check if we tapped a slot
    for (let i = 0; i < SLOT_COUNT; i++) {
      const rect = getSlotRect(i);
      if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
        // If a different block is already active, cancel it first
        if (this._gc.blocks.active !== null) {
          this._gc.cancelActive();
        }
        const ok = this._gc.selectSlot(i);
        if (ok) {
          this._dragging = true;
          this._dragSlotIndex = i;
          this._dragX = x;
          this._dragY = y;
        }
        return;
      }
    }

    // Tap on board while block is active → move to column
    if (this._gc.blocks.active) {
      const col = this._getBoardCol(x);
      if (col !== null) {
        this._gc.blocks.moveActive(0, col - this._gc.blocks.active.col);
        this._dragging = true;
        this._dragX = x;
        this._dragY = y;
      }
    }
  }

  private _moveInteraction(clientX: number, clientY: number): void {
    if (!this._dragging || !this._gc.blocks.active) return;
    const { x } = this._toCanvas(clientX, clientY);
    const col = this._getBoardCol(x);
    if (col !== null) {
      const diff = col - this._gc.blocks.active.col;
      if (diff !== 0) this._gc.blocks.moveActive(0, diff > 0 ? 1 : -1);
    }
    this._dragX = x;
  }

  private _endInteraction(clientX: number, clientY: number): void {
    if (!this._dragging) return;
    this._dragging = false;
    this._dragSlotIndex = -1;

    if (!this._gc.blocks.active || this._gc.state !== GameState.PLAYING) return;

    const { x, y } = this._toCanvas(clientX, clientY);
    // Cancel zone: right-side path area below the board (above END marker)
    const inCancelZone = x >= CANCEL_ZONE_X && x <= CANCEL_ZONE_X + CANCEL_ZONE_W
                      && y >= CANCEL_ZONE_Y && y <= CANCEL_ZONE_Y + CANCEL_ZONE_H;
    if (inCancelZone) {
      this._gc.cancelActive();
    } else {
      this._gc.dropActive();
    }
  }

  private _getBoardCol(x: number): number | null {
    const col = Math.floor((x - BOARD_LEFT) / CELL_SIZE);
    if (col < 0 || col >= COLS) return null;
    return col;
  }
}

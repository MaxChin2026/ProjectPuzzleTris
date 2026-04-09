// ============================================================
// ELEMENTRIS — BlockManager
// Manages 5-slot block selection, generation with soft-constraint,
// active block movement, ghost piece, lock-down
// ============================================================

import { BlockDef, ShapeType, CellType, ElementType } from './types';
import {
  COLS, ROWS, SHAPES,
  SLOT_COUNT, ELEMENT_TYPES, ELEMENT_COLORS,
} from './constants';
import { BoardManager } from './BoardManager';

const SHAPE_TYPES: ShapeType[] = [
  ShapeType.I, ShapeType.O, ShapeType.T,
  ShapeType.S, ShapeType.Z, ShapeType.J, ShapeType.L,
];

function randomShape(): ShapeType {
  return SHAPE_TYPES[Math.floor(Math.random() * SHAPE_TYPES.length)];
}

/** Classify a block's rotation as horizontal (W>H), vertical (H>W), or neutral */
function classifyOrientation(cells: [number, number][]): 'H' | 'V' | 'N' {
  const rows = cells.map(([r]) => r);
  const cols = cells.map(([, c]) => c);
  const h = Math.max(...rows) - Math.min(...rows) + 1;
  const w = Math.max(...cols) - Math.min(...cols) + 1;
  if (w > h) return 'H';
  if (h > w) return 'V';
  return 'N';
}

/** Pick a rotation index biased toward preferred orientation; falls back to any rotation */
function pickRotationWithBias(shape: ShapeType, prefer: 'H' | 'V' | null): number {
  if (!prefer) return Math.floor(Math.random() * 4);
  const preferred: number[] = [];
  const others: number[] = [];
  for (let rot = 0; rot < 4; rot++) {
    const o = classifyOrientation(makeCells(shape, rot));
    if (o === prefer) preferred.push(rot);
    else others.push(rot);
  }
  const pool = preferred.length > 0 ? preferred : others;
  return pool[Math.floor(Math.random() * pool.length)];
}

function randomRotation(): number {
  return Math.floor(Math.random() * 4);
}

function makeCells(shape: ShapeType, rotation: number): [number, number][] {
  return SHAPES[shape][rotation % SHAPES[shape].length] as [number, number][];
}

/** Check if a block can be placed anywhere on the board (used by soft-constraint only) */
function canPlaceAnywhere(shape: ShapeType, rotation: number, board: BoardManager): boolean {
  const cells = makeCells(shape, rotation);
  const rowOffsets = cells.map(([r]) => r);
  const colOffsets = cells.map(([, c]) => c);
  const minCol = Math.min(...colOffsets);
  const maxCol = Math.max(...colOffsets);
  const height  = Math.max(...rowOffsets) + 1;

  // Try all possible column positions and all rows where the block can be dropped
  for (let startCol = -minCol; startCol <= COLS - (maxCol - minCol + 1); startCol++) {
    // Find lowest valid row for this column by simulating a drop
    for (let startRow = 0; startRow <= ROWS - height; startRow++) {
      let ok = true;
      for (const [dr, dc] of cells) {
        const r = startRow + dr;
        const c = startCol + dc;
        if (c < 0 || c >= COLS || r < 0 || r >= ROWS) { ok = false; break; }
        if (board.isOccupied(r, c)) { ok = false; break; }
      }
      if (ok) return true;
    }
  }
  return false;
}

function generateBlock(board: BoardManager, orientHint: 'H' | 'V' | null = null): BlockDef {
  const shape = randomShape();
  const rotation = pickRotationWithBias(shape, orientHint);
  const cells = makeCells(shape, rotation);
  const elementType: ElementType = ELEMENT_TYPES[Math.floor(Math.random() * ELEMENT_TYPES.length)];
  const color = ELEMENT_COLORS[elementType];

  return { shape, rotation, cells, color, elementType };
}

// Active block on the board
export interface ActiveBlock {
  def: BlockDef;
  row: number;   // top-left anchor row
  col: number;   // top-left anchor col
  slotIndex: number;
}

export class BlockManager {
  slots: (BlockDef | null)[];
  active: ActiveBlock | null = null;
  private _board: BoardManager;

  constructor(board: BoardManager) {
    this._board = board;
    this.slots = Array(SLOT_COUNT).fill(null);
    this.refillSlots();
  }

  refillSlots(): void {
    for (let i = 0; i < SLOT_COUNT; i++) {
      if (this.slots[i] === null) {
        // Collect shapes already in other slots (no duplicates)
        const usedShapes = new Set<ShapeType>(
          this.slots.filter((s, idx) => idx !== i && s !== null).map(s => s!.shape)
        );
        // Count orientation of existing slots to determine balance hint
        let hCount = 0, vCount = 0;
        for (const s of this.slots) {
          if (s === null) continue;
          const o = classifyOrientation(s.cells);
          if (o === 'H') hCount++;
          else if (o === 'V') vCount++;
        }
        const orientHint: 'H' | 'V' | null = vCount > hCount ? 'H' : hCount > vCount ? 'V' : null;
        this.slots[i] = this._generateSingle(usedShapes, orientHint);
      }
    }
  }

  private _generateSingle(excludeShapes: Set<ShapeType> = new Set(), orientHint: 'H' | 'V' | null = null): BlockDef {
    // Try up to 10 times: honour shape-uniqueness + orientation balance + soft placement constraint
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = generateBlock(this._board, orientHint);
      if (excludeShapes.has(candidate.shape)) continue;
      if (canPlaceAnywhere(candidate.shape, candidate.rotation, this._board)) {
        return candidate;
      }
    }

    // Relaxed fallback: find any shape not in excludeShapes that can be placed
    const available = SHAPE_TYPES.filter(s => !excludeShapes.has(s));
    const shapesToTry = available.length > 0 ? available : SHAPE_TYPES;
    for (const shape of shapesToTry) {
      const rot = pickRotationWithBias(shape, orientHint);
      if (canPlaceAnywhere(shape, rot, this._board)) {
        const cells = makeCells(shape, rot);
        const elementType: ElementType = ELEMENT_TYPES[Math.floor(Math.random() * ELEMENT_TYPES.length)];
        return { shape, rotation: rot, cells, color: ELEMENT_COLORS[elementType], elementType };
      }
      // Also try the opposite rotation preference as second fallback
      for (let r = 0; r < 4; r++) {
        if (r === rot) continue;
        if (canPlaceAnywhere(shape, r, this._board)) {
          const cells = makeCells(shape, r);
          const elementType: ElementType = ELEMENT_TYPES[Math.floor(Math.random() * ELEMENT_TYPES.length)];
          return { shape, rotation: r, cells, color: ELEMENT_COLORS[elementType], elementType };
        }
      }
    }

    // Last resort: I-horizontal (board is nearly full — GAME OVER imminent)
    const safeShape = ShapeType.I;
    const safeRot = 0;
    const cells = makeCells(safeShape, safeRot);
    const elementType: ElementType = ELEMENT_TYPES[0];
    return { shape: safeShape, rotation: safeRot, cells, color: ELEMENT_COLORS[elementType], elementType };
  }

  /** Select a slot and place as active block at the top-center of board */
  selectSlot(index: number): boolean {
    const def = this.slots[index];
    if (!def || this.active) return false;

    // Calculate spawn column: center the block
    const cols = def.cells.map(([, c]) => c);
    const minC = Math.min(...cols);
    const maxC = Math.max(...cols);
    const blockW = maxC - minC + 1;
    const startCol = Math.floor((COLS - blockW) / 2) - minC;
    const startRow = 0;

    if (!this.canPlace(def, startRow, startCol)) return false;

    this.active = { def, row: startRow, col: startCol, slotIndex: index };
    this.slots[index] = null;
    return true;
  }

  /** Cancel active block and return it to its original slot */
  cancelActive(): void {
    if (!this.active) return;
    this.slots[this.active.slotIndex] = this.active.def;
    this.active = null;
  }

  canPlace(def: BlockDef, row: number, col: number): boolean {
    for (const [dr, dc] of def.cells) {
      if (this._board.isOccupied(row + dr, col + dc)) return false;
      if (col + dc < 0 || col + dc >= COLS) return false;
      if (row + dr >= ROWS) return false;
    }
    return true;
  }

  moveActive(dRow: number, dCol: number): boolean {
    if (!this.active) return false;
    const newRow = this.active.row + dRow;
    const newCol = this.active.col + dCol;

    // Normal placement
    if (this.canPlace(this.active.def, newRow, newCol)) {
      this.active.row = newRow;
      this.active.col = newCol;
      return true;
    }

    // Horizontal slide: if the target column is blocked at the current row,
    // try sliding down row by row to find the first valid position —
    // simulates the classic Tetris "squeeze into gap under overhang" mechanic.
    // The piece can only move downward (gravity), never upward.
    if (dRow === 0 && dCol !== 0) {
      for (let r = this.active.row + 1; r < ROWS; r++) {
        if (this.canPlace(this.active.def, r, newCol)) {
          this.active.row = r;
          this.active.col = newCol;
          return true;
        }
      }
    }

    return false;
  }

  /** Drop active block to its lowest valid position */
  hardDrop(): void {
    if (!this.active) return;
    while (this.canPlace(this.active.def, this.active.row + 1, this.active.col)) {
      this.active.row++;
    }
  }

  /** Lock active block onto board, return cells locked */
  lockActive(): Array<{ row: number; col: number; color: string; elementType: ElementType }> {
    if (!this.active) return [];
    const result: Array<{ row: number; col: number; color: string; elementType: ElementType }> = [];

    for (let i = 0; i < this.active.def.cells.length; i++) {
      const [dr, dc] = this.active.def.cells[i];
      const r = this.active.row + dr;
      const c = this.active.col + dc;
      result.push({ row: r, col: c, color: this.active.def.color, elementType: this.active.def.elementType });
    }

    this._board.lockCells(result);
    this.active = null;
    return result;
  }

  /** Calculate ghost piece position (lowest valid drop) */
  getGhostRow(): number {
    if (!this.active) return 0;
    let ghostRow = this.active.row;
    while (this.canPlace(this.active.def, ghostRow + 1, this.active.col)) {
      ghostRow++;
    }
    return ghostRow;
  }

  reset(): void {
    this.slots = Array(SLOT_COUNT).fill(null);
    this.active = null;
    this.refillSlots();
  }
}

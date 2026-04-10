// ============================================================
// ELEMENTRIS â€?BlockManager (Tetris-style gravity)
// Single active block falls from top; player moves/rotates.
// After lock, next block auto-spawns.
// ============================================================

import { BlockDef, ShapeType, ElementType } from './types';
import {
  COLS, ROWS, SHAPES,
  ELEMENT_TYPES, ELEMENT_COLORS,
} from './constants';
import { BoardManager } from './BoardManager';

const SHAPE_TYPES: ShapeType[] = [
  ShapeType.I, ShapeType.O, ShapeType.T,
  ShapeType.S, ShapeType.Z, ShapeType.J, ShapeType.L,
];

// 7-bag random generator for fair distribution
class BagGenerator {
  private _bag: ShapeType[] = [];
  next(): ShapeType {
    if (this._bag.length === 0) {
      this._bag = [...SHAPE_TYPES];
      // Fisher-Yates shuffle
      for (let i = this._bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this._bag[i], this._bag[j]] = [this._bag[j], this._bag[i]];
      }
    }
    return this._bag.pop()!;
  }
}

function makeCells(shape: ShapeType, rotation: number): [number, number][] {
  return SHAPES[shape][rotation % SHAPES[shape].length] as [number, number][];
}

function generateBlock(bag: BagGenerator): BlockDef {
  const shape = bag.next();
  const rotation = 0;
  const cells = makeCells(shape, rotation);
  const elementType: ElementType = ELEMENT_TYPES[Math.floor(Math.random() * ELEMENT_TYPES.length)];
  return { shape, rotation, cells, color: ELEMENT_COLORS[elementType], elementType };
}

// Wall-kick offsets: [dRow, dCol] to try for each rotation
// Uses simplified SRS kicks (same for all pieces except I which gets wider tries)
const WALL_KICKS: [number, number][] = [
  [0, 0], [0, -1], [0, 1], [0, -2], [0, 2], [-1, 0], [-1, -1], [-1, 1],
];

export interface ActiveBlock {
  def: BlockDef;
  row: number;   // anchor row
  col: number;   // anchor col
}

export class BlockManager {
  active: ActiveBlock | null = null;
  next: BlockDef;

  private _board: BoardManager;
  private _bag: BagGenerator;

  constructor(board: BoardManager) {
    this._board = board;
    this._bag = new BagGenerator();
    this.next = generateBlock(this._bag);
    this._spawnNext();
  }

  private _spawnNext(): void {
    const def = this.next;
    this.next = generateBlock(this._bag);

    const cols = def.cells.map(([, c]) => c);
    const minC = Math.min(...cols);
    const maxC = Math.max(...cols);
    const blockW = maxC - minC + 1;
    const startCol = Math.floor((COLS - blockW) / 2) - minC;
    const startRow = 0;

    // Spawn even if overlapping (game-over detection happens in GameController)
    this.active = { def, row: startRow, col: startCol };
  }

  canPlace(def: BlockDef, row: number, col: number): boolean {
    for (const [dr, dc] of def.cells) {
      const r = row + dr;
      const c = col + dc;
      if (c < 0 || c >= COLS) return false;
      if (r >= ROWS) return false;
      // Above the board is allowed (pieces spawn above row 0)
      if (r >= 0 && this._board.isOccupied(r, c)) return false;
    }
    return true;
  }

  canMoveDown(): boolean {
    if (!this.active) return false;
    return this.canPlace(this.active.def, this.active.row + 1, this.active.col);
  }

  moveActive(dRow: number, dCol: number): boolean {
    if (!this.active) return false;
    const newRow = this.active.row + dRow;
    const newCol = this.active.col + dCol;
    if (!this.canPlace(this.active.def, newRow, newCol)) return false;
    this.active.row = newRow;
    this.active.col = newCol;
    return true;
  }

  /** Rotate active block clockwise with wall kicks */
  rotate(): boolean {
    if (!this.active) return false;
    const def = this.active.def;
    const newRot = (def.rotation + 1) % 4;
    const newCells = makeCells(def.shape, newRot);
    const newDef: BlockDef = { ...def, rotation: newRot, cells: newCells };

    for (const [dRow, dCol] of WALL_KICKS) {
      const testRow = this.active.row + dRow;
      const testCol = this.active.col + dCol;
      if (this.canPlace(newDef, testRow, testCol)) {
        this.active.def = newDef;
        this.active.row = testRow;
        this.active.col = testCol;
        return true;
      }
    }
    return false;
  }

  /** Hard drop: move to lowest valid row, returns number of rows dropped */
  hardDrop(): number {
    if (!this.active) return 0;
    let dropped = 0;
    while (this.canPlace(this.active.def, this.active.row + 1, this.active.col)) {
      this.active.row++;
      dropped++;
    }
    return dropped;
  }

  /** Lock active block onto board; returns locked cells info */
  lockActive(): Array<{ row: number; col: number; color: string; elementType: ElementType }> {
    if (!this.active) return [];
    const result: Array<{ row: number; col: number; color: string; elementType: ElementType }> = [];
    for (const [dr, dc] of this.active.def.cells) {
      const r = this.active.row + dr;
      const c = this.active.col + dc;
      result.push({ row: r, col: c, color: this.active.def.color, elementType: this.active.def.elementType });
    }
    this._board.lockCells(result);
    this.active = null;
    return result;
  }

  /** Ghost row: lowest valid row the active piece can drop to */
  getGhostRow(): number {
    if (!this.active) return 0;
    let ghostRow = this.active.row;
    while (this.canPlace(this.active.def, ghostRow + 1, this.active.col)) {
      ghostRow++;
    }
    return ghostRow;
  }

  /** Spawn next piece after locking */
  spawnNext(): void {
    this._spawnNext();
  }

  reset(): void {
    this._bag = new BagGenerator();
    this.next = generateBlock(this._bag);
    this.active = null;
    this._spawnNext();
  }
}

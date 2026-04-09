// ============================================================
// ELEMENTRIS — BoardManager
// Manages 10×20 grid state, line clear detection, bottom-row addition
// ============================================================

import { Board, Cell, CellType, ElementType } from './types';
import { COLS, ROWS, COLOR_EMPTY, COLOR_BOTTOM_ROW, ELEMENT_TYPES } from './constants';

export interface ClearResult {
  clearedRows: number[];   // row indices that were cleared (top=0)
  /** cells cleared per element type across all cleared rows */
  energyGained: Record<ElementType, number>;
}

export class BoardManager {
  board: Board;

  constructor() {
    this.board = this._createEmptyBoard();
  }

  private _createEmptyBoard(): Board {
    return Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, (): Cell => ({ type: CellType.EMPTY, color: COLOR_EMPTY }))
    );
  }

  getCell(row: number, col: number): Cell {
    return this.board[row][col];
  }

  setCell(row: number, col: number, cell: Cell): void {
    this.board[row][col] = { ...cell };
  }

  clearCell(row: number, col: number): void {
    this.board[row][col] = { type: CellType.EMPTY, color: COLOR_EMPTY };
  }

  /** Check whether a position is occupied (for collision detection) */
  isOccupied(row: number, col: number): boolean {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return true;
    const t = this.board[row][col].type;
    return t === CellType.BLOCK || t === CellType.BOTTOM_ROW;
  }

  /** Lock a placed block's cells onto the board */
  lockCells(cells: Array<{ row: number; col: number; color: string; elementType?: ElementType }>): void {
    for (const c of cells) {
      if (c.row >= 0 && c.row < ROWS && c.col >= 0 && c.col < COLS) {
        this.board[c.row][c.col] = {
          type: CellType.BLOCK,
          color: c.color,
          elementType: c.elementType,
        };
      }
    }
  }

  /** Check for full rows and remove them; returns clear result */
  checkAndClearRows(): ClearResult {
    const clearedRows: number[] = [];
    const energyGained: Record<ElementType, number> = { fire: 0, lightning: 0, frost: 0, hurricane: 0 };

    for (let r = 0; r < ROWS; r++) {
      if (this._isRowFull(r)) {
        // Count element cells in this row
        for (let c = 0; c < COLS; c++) {
          const cell = this.board[r][c];
          if (cell.elementType && ELEMENT_TYPES.includes(cell.elementType)) {
            energyGained[cell.elementType]++;
          }
        }
        clearedRows.push(r);
      }
    }

    if (clearedRows.length > 0) {
      this._removeRows(clearedRows);
    }

    return { clearedRows, energyGained };
  }

  private _isRowFull(row: number): boolean {
    for (let c = 0; c < COLS; c++) {
      const t = this.board[row][c].type;
      if (t === CellType.EMPTY || t === CellType.GHOST) return false;
    }
    return true;
  }

  /** Remove cleared rows and drop content above down */
  private _removeRows(rows: number[]): void {
    const rowSet = new Set(rows);
    const remaining: Cell[][] = [];

    for (let r = 0; r < ROWS; r++) {
      if (!rowSet.has(r)) {
        remaining.push(this.board[r]);
      }
    }

    // Prepend empty rows at top
    while (remaining.length < ROWS) {
      remaining.unshift(
        Array.from({ length: COLS }, (): Cell => ({ type: CellType.EMPTY, color: COLOR_EMPTY }))
      );
    }

    this.board = remaining;
  }

  /** Add a row at the bottom with one random gap; push existing content up */
  addBottomRow(gapCol?: number): boolean {
    const gap = gapCol !== undefined ? gapCol : Math.floor(Math.random() * COLS);

    // Check if top row has any non-empty cells (would cause game over)
    for (let c = 0; c < COLS; c++) {
      if (this.board[0][c].type !== CellType.EMPTY && this.board[0][c].type !== CellType.GHOST) {
        return false; // signals board full
      }
    }

    // Shift all rows up by 1
    for (let r = 0; r < ROWS - 1; r++) {
      this.board[r] = this.board[r + 1];
    }

    // New bottom row
    const newRow: Cell[] = Array.from({ length: COLS }, (_, c): Cell =>
      c === gap
        ? { type: CellType.EMPTY, color: COLOR_EMPTY }
        : { type: CellType.BOTTOM_ROW, color: COLOR_BOTTOM_ROW }
    );
    this.board[ROWS - 1] = newRow;
    return true;
  }

  /** Check if the block spawn area (top 4 rows) is occupied */
  isTopBlocked(): boolean {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = this.board[r][c].type;
        if (t === CellType.BLOCK || t === CellType.BOTTOM_ROW) {
          return true;
        }
      }
    }
    return false;
  }

  /** Count filled cells in each row for SKL_CHAIN_CLEAR */
  rowFillCounts(): { row: number; gaps: number }[] {
    return this.board.map((row, r) => {
      let gaps = 0;
      for (let c = 0; c < COLS; c++) {
        if (row[c].type === CellType.EMPTY || row[c].type === CellType.GHOST) gaps++;
      }
      return { row: r, gaps };
    });
  }

  /** Fill gaps in a row with BLOCK cells (used by SKL_CHAIN_CLEAR) */
  fillRowGaps(row: number, color: string): void {
    for (let c = 0; c < COLS; c++) {
      if (this.board[row][c].type === CellType.EMPTY || this.board[row][c].type === CellType.GHOST) {
        this.board[row][c] = { type: CellType.BLOCK, color };
      }
    }
  }

  reset(): void {
    this.board = this._createEmptyBoard();
  }
}

// ============================================================
// ELEMENTRIS — Layout utilities (no dependency on game modules)
// ============================================================

import { BOARD_LEFT, BOARD_TOP, CELL_SIZE, COLS, ROWS, SLOT_COUNT, PATH_WIDTH } from './constants';

export const SLOT_H = 80;
export const SLOT_Y = BOARD_TOP + ROWS * CELL_SIZE + 5;

/** Cancel zone: right path area below the board (above END marker) */
export const CANCEL_ZONE_X = BOARD_LEFT + COLS * CELL_SIZE;
export const CANCEL_ZONE_Y = BOARD_TOP + ROWS * CELL_SIZE;
export const CANCEL_ZONE_W = PATH_WIDTH;
export const CANCEL_ZONE_H = SLOT_H + 5; // covers slot area height

export function getSlotRect(i: number): { x: number; y: number; w: number; h: number } {
  const totalW = COLS * CELL_SIZE;
  const gap    = 4;
  const slotW  = (totalW - (SLOT_COUNT + 1) * gap) / SLOT_COUNT;
  const x = BOARD_LEFT + gap + i * (slotW + gap);
  return { x, y: SLOT_Y, w: slotW, h: SLOT_H };
}

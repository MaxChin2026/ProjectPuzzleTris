// ============================================================
// ELEMENTRIS -  utilities (no dependency on game modules)
// ============================================================

import {
  BOARD_LEFT, BOARD_TOP, CELL_SIZE, COLS, ROWS,
  PATH_WIDTH, CONTROL_AREA_H, CANVAS_W, SKILL_PANEL_W,
} from './constants';

// Control area dimensions
export const CTRL_Y = BOARD_TOP + ROWS * CELL_SIZE;   // top of control zone
export const CTRL_H = CONTROL_AREA_H;

// ---- Virtual D-pad (bottom-left) ----------------------------
export const DPAD_CX         = 82;                    // D-pad center x
export const DPAD_CY         = CTRL_Y + CTRL_H / 2;  // D-pad center y
export const DPAD_BTN_OFFSET = 42;                    // px from center to button center
export const DPAD_BTN_SIZE   = 36;                    // button width & height

export function getDpadBtnRect(dir: 'left' | 'right' | 'up' | 'down'): {
  x: number; y: number; w: number; h: number;
} {
  const half = DPAD_BTN_SIZE / 2;
  switch (dir) {
    case 'left':  return { x: DPAD_CX - DPAD_BTN_OFFSET - half, y: DPAD_CY - half, w: DPAD_BTN_SIZE, h: DPAD_BTN_SIZE };
    case 'right': return { x: DPAD_CX + DPAD_BTN_OFFSET - half, y: DPAD_CY - half, w: DPAD_BTN_SIZE, h: DPAD_BTN_SIZE };
    case 'up':    return { x: DPAD_CX - half, y: DPAD_CY - DPAD_BTN_OFFSET - half, w: DPAD_BTN_SIZE, h: DPAD_BTN_SIZE };
    case 'down':  return { x: DPAD_CX - half, y: DPAD_CY + DPAD_BTN_OFFSET - half, w: DPAD_BTN_SIZE, h: DPAD_BTN_SIZE };
  }
}

/** Returns which D-pad button contains (x, y), or null */
export function hitDpadBtn(x: number, y: number): 'left' | 'right' | 'up' | 'down' | null {
  for (const dir of ['left', 'right', 'up', 'down'] as const) {
    const r = getDpadBtnRect(dir);
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return dir;
  }
  return null;
}

// ---- Rotate button (bottom-right) ---------------------------
export const ROTATE_BTN_CX = CANVAS_W - SKILL_PANEL_W - 52;  // center x
export const ROTATE_BTN_CY = CTRL_Y + CTRL_H / 2;            // center y
export const ROTATE_BTN_R  = 34;                              // radius px

export function isInRotateBtn(x: number, y: number): boolean {
  const dx = x - ROTATE_BTN_CX;
  const dy = y - ROTATE_BTN_CY;
  return dx * dx + dy * dy <= ROTATE_BTN_R * ROTATE_BTN_R;
}

// ---- Next-piece preview (center of control area) ------------
export const NEXT_BOX_X = 170;
export const NEXT_BOX_Y = CTRL_Y + 8;
export const NEXT_BOX_W = 78;
export const NEXT_BOX_H = CTRL_H - 16;

// ---- Level-up skill card layout ----------------------------
export const LEVELUP_CARD_W   = 98;
export const LEVELUP_CARD_H   = 120;
export const LEVELUP_CARD_GAP = 10;

export function getLevelUpCardRect(index: number): { x: number; y: number; w: number; h: number } {
  const totalW = 3 * LEVELUP_CARD_W + 2 * LEVELUP_CARD_GAP;
  const startX = Math.floor((CANVAS_W - totalW) / 2);
  const boardH = ROWS * CELL_SIZE;
  const startY = BOARD_TOP + Math.floor((boardH - LEVELUP_CARD_H) / 2);
  return {
    x: startX + index * (LEVELUP_CARD_W + LEVELUP_CARD_GAP),
    y: startY,
    w: LEVELUP_CARD_W,
    h: LEVELUP_CARD_H,
  };
}

// ---- Skill panel position -----------------------------------
export const SKILL_PANEL_X = BOARD_LEFT + COLS * CELL_SIZE + PATH_WIDTH;

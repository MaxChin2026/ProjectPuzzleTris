// ============================================================
// ELEMENTRIS — Constants
// ============================================================

export const COLS = 10;
export const ROWS = 20;
export const CELL_SIZE = 28;          // pixels per grid cell
export const PATH_WIDTH = 30;         // enemy path lane width px

// Board layout
export const BOARD_LEFT = PATH_WIDTH; // board x offset (path on left)
export const BOARD_TOP  = 60;         // HUD height — compact for mobile

// Canvas dimensions
export const CANVAS_W = BOARD_LEFT + COLS * CELL_SIZE + PATH_WIDTH + SKILL_PANEL_W;
export const CANVAS_H = BOARD_TOP + ROWS * CELL_SIZE + 90;   // +90 for slot area

// Block slot area (below board)
export const SLOT_AREA_H = 80;
export const SLOT_COUNT  = 5;

// Timing
// Wave-based enemy spawning
export const WAVE_SIZE_BASE        = 5;    // enemies in wave 1
export const INTRA_WAVE_DELAY_MS   = 500;  // delay between enemies within a wave (ms) — tight formation
export const INTER_WAVE_DELAY_MS   = 10000; // delay between waves (ms) — longer reaction window

// Combat
export const BASE_DAMAGE = 10;        // per bullet (one grid cell)
export const CRIT_MULTIPLIERS: readonly number[] = [1.0, 1.5, 2.0, 3.0];
export const BULLET_FLIGHT_MS = 350;  // bullet travel time

// Element system — 4 colors map to 4 skills
import { ElementType } from './types';
export const ELEMENT_TYPES: ElementType[] = ['fire', 'lightning', 'frost', 'hurricane'];
export const ELEMENT_COLORS: Record<ElementType, string> = {
  fire:      '#ff4444',
  lightning: '#ffdd00',
  frost:     '#44b8ff',
  hurricane: '#44ff88',
};
export const SKILL_ENERGY_PER_CHARGE = 20; // cells of that color per charge

// Skill panel width (appended to the right of the right path)
export const SKILL_PANEL_W = 52;

// Colors
export const COLOR_EMPTY      = '#1a1a2e';
export const COLOR_GHOST      = 'rgba(255,255,255,0.12)';
export const COLOR_GRID_LINE  = 'rgba(255,255,255,0.06)';
export const COLOR_BOTTOM_ROW = '#2a2a3a';
export const COLOR_HUD_BG     = '#12121e';
export const COLOR_PATH_BG    = 'rgba(255,255,255,0.03)';
export const COLOR_ENEMY_HP   = '#e74c3c';
export const COLOR_ENEMY_HP_BG= '#333';

export const SHAPE_COLORS: Record<string, string> = {
  I: '#00cfff',
  O: '#f5c400',
  T: '#be5ff5',
  S: '#39d353',
  Z: '#ff4b4b',
  J: '#2563eb',
  L: '#ff8c00',
};

export const CRIT_COLORS = ['#8ab4ff', '#ff9500', '#ff2222', '#ff0'];

// Shapes: [rotation][cell] = [row, col]
type ShapeDef = [number, number][][];

export const SHAPES: Record<string, ShapeDef> = {
  I: [
    [[0,0],[0,1],[0,2],[0,3]],
    [[0,0],[1,0],[2,0],[3,0]],
    [[0,0],[0,1],[0,2],[0,3]],
    [[0,0],[1,0],[2,0],[3,0]],
  ],
  O: [
    [[0,0],[0,1],[1,0],[1,1]],
    [[0,0],[0,1],[1,0],[1,1]],
    [[0,0],[0,1],[1,0],[1,1]],
    [[0,0],[0,1],[1,0],[1,1]],
  ],
  T: [
    [[0,1],[1,0],[1,1],[1,2]],
    [[0,0],[1,0],[1,1],[2,0]],
    [[0,0],[0,1],[0,2],[1,1]],
    [[0,1],[1,0],[1,1],[2,1]],
  ],
  S: [
    [[0,1],[0,2],[1,0],[1,1]],
    [[0,0],[1,0],[1,1],[2,1]],
    [[0,1],[0,2],[1,0],[1,1]],
    [[0,0],[1,0],[1,1],[2,1]],
  ],
  Z: [
    [[0,0],[0,1],[1,1],[1,2]],
    [[0,1],[1,0],[1,1],[2,0]],
    [[0,0],[0,1],[1,1],[1,2]],
    [[0,1],[1,0],[1,1],[2,0]],
  ],
  J: [
    [[0,0],[1,0],[1,1],[1,2]],
    [[0,0],[0,1],[1,0],[2,0]],
    [[0,0],[0,1],[0,2],[1,2]],
    [[0,1],[1,1],[2,0],[2,1]],
  ],
  L: [
    [[0,2],[1,0],[1,1],[1,2]],
    [[0,0],[1,0],[2,0],[2,1]],
    [[0,0],[0,1],[0,2],[1,0]],
    [[0,0],[0,1],[1,1],[2,1]],
  ],
};

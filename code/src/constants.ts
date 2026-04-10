// ============================================================
// ELEMENTRIS — Constants
// ============================================================

export const COLS = 10;
export const ROWS = 20;
export const CELL_SIZE = 28;          // pixels per grid cell
export const PATH_WIDTH = 30;         // enemy path lane width px
export const SKILL_PANEL_W = 52;      // skill panel width (right side)

// Board layout
export const BOARD_LEFT = PATH_WIDTH; // board x offset (path on left)
export const BOARD_TOP  = 60;         // HUD height — compact for mobile

// Canvas dimensions
export const CONTROL_AREA_H = 120;   // virtual D-pad + rotate button below board
export const CANVAS_W = BOARD_LEFT + COLS * CELL_SIZE + PATH_WIDTH + SKILL_PANEL_W;
export const CANVAS_H = BOARD_TOP + ROWS * CELL_SIZE + CONTROL_AREA_H;

// Tetris gravity
export const FALL_START_INTERVAL_MS = 800;  // ms per gravity step at level 1
export const FALL_MIN_INTERVAL_MS   = 80;   // fastest gravity step
export const SOFT_DROP_INTERVAL_MS  = 50;   // ms per step during soft drop
export const LOCK_DELAY_MS         = 500;   // ms on ground before locking
export const LEVEL_SPEED_FACTOR    = 0.93;  // gravity interval *= this per Tetris level

// Hero system
export const HERO_BASE_XP        = 80;    // XP needed for level 2
export const HERO_XP_MULTIPLIER  = 1.35;  // XP needed scales up each level
export const HERO_XP_TABLE: Record<number, number> = {
  1: 10, 2: 25, 3: 50, 4: 100,   // XP awarded for clearing 1/2/3/4 rows
};

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

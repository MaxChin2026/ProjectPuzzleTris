// ============================================================
// ELEMENTRIS — Core Types
// ============================================================

// ---- Enumerations -------------------------------------------

export const enum CellType {
  EMPTY = 0,
  BLOCK = 1,
  GHOST = 3,
  BOTTOM_ROW = 4,
}

// Element types — determine block color and skill energy type
export type ElementType = 'fire' | 'lightning' | 'frost' | 'hurricane';

export const enum GameState {
  IDLE = 'IDLE',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  LEVEL_UP = 'LEVEL_UP',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY',
}

// ---- Passive Skills -----------------------------------------

export type PassiveSkillId =
  | 'dmg_up'       | 'fire_dmg'     | 'lightning_dmg' | 'frost_dur'
  | 'hurricane_kb' | 'multi_clear'  | 'energy_eff'    | 'hp_regen'
  | 'wave_slow'    | 'crit_chance'  | 'fire_zone_dot' | 'chain_bolt'
  | 'blizzard'     | 'cyclone';

export interface PassiveSkillDef {
  id: PassiveSkillId;
  name: string;
  desc: string;
  element: ElementType | 'neutral';
  icon: string;
}

export const enum ShapeType {
  I = 'I', O = 'O', T = 'T', S = 'S', Z = 'Z', J = 'J', L = 'L',
}

export const enum EnemyType {
  NORMAL = 'NORMAL',
  ELITE = 'ELITE',
  BOSS = 'BOSS',
}

export const enum StatusEffectType {
  SLOW = 'SLOW',
  FREEZE = 'FREEZE',
  STUN = 'STUN',
  ARMOR_BREAK = 'ARMOR_BREAK',
  FIRE = 'FIRE',
}

// ---- Board --------------------------------------------------

export interface Cell {
  type: CellType;
  color: string;
  elementType?: ElementType;
}

export type Board = Cell[][];  // [row][col], row 0 = top

// ---- Blocks -------------------------------------------------

export interface BlockDef {
  shape: ShapeType;
  rotation: number;          // 0-3
  cells: [number, number][]; // [row, col] offsets
  color: string;
  elementType: ElementType;
}

// ---- Enemies ------------------------------------------------

export interface StatusEffect {
  type: StatusEffectType;
  remaining: number;         // seconds
  value?: number;            // e.g. slow percentage, armor reduction
}

export interface Enemy {
  id: string;
  type: EnemyType;
  hp: number;
  maxHp: number;
  speed: number;             // path progress per second (0~1)
  armor: number;             // damage reduction 0~1
  leakDamage: number;        // player HP reduction on reaching end
  pathProgress: number;      // 0.0 = start, 1.0 = end
  statusEffects: StatusEffect[];
  immuneToStun: boolean;
  immuneToFreeze: boolean;
  // rendering
  x: number;
  y: number;
}

// ---- Bullets ------------------------------------------------

export interface Bullet {
  id: string;
  startX: number;
  startY: number;
  controlX: number;
  controlY: number;
  targetEnemy: Enemy;
  damage: number;
  critMultiplier: number;
  progress: number;          // 0~1
  color: string;
  lineWidth: number;
}

// ---- Config -------------------------------------------------

export interface LevelConfig {
  stage: number;
  addRowInterval: number;   // ms between bottom row additions
  enemySpawnInterval: number;
  waveSize: number;
  enemyTypes: EnemyType[];
}

export interface EnemyConfig {
  type: EnemyType;
  id: string;
  hp: number;
  speed: number;
  armor: number;
  leakDamage: number;
  immuneToStun: boolean;
  immuneToFreeze: boolean;
  color: string;
  radius: number;
}

// ---- Events -------------------------------------------------

export type GameEvent =
  | { type: 'ROWS_CLEARED'; rows: number[]; rowCount: number }
  | { type: 'BLOCK_PLACED' }
  | { type: 'ENEMY_LEAKED'; enemy: Enemy }
  | { type: 'ENEMY_KILLED'; enemy: Enemy }
  | { type: 'BOARD_FULL' }
  | { type: 'HP_ZERO' };

export type EventHandler = (event: GameEvent) => void;

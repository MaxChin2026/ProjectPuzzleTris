// ============================================================
// ELEMENTRIS — EnemyManager
// Three-edge path: bottom-left → left-up → top-left→right → right-down → bottom-right
// ============================================================

import { Enemy, EnemyType, StatusEffect, StatusEffectType } from './types';
import {
  BOARD_LEFT, BOARD_TOP, COLS, ROWS, CELL_SIZE, PATH_WIDTH,
} from './constants';

// ---- Path computation ----------------------------------------
// Path goes: start (left-bottom outside) → up left edge → across top → down right edge → end (right-bottom outside)
// Normalized path progress 0..1

interface PathPoint { x: number; y: number }

export function getPathPosition(progress: number): PathPoint {
  // Total path length = 3 sides of the board (left, top, right)
  const boardH = ROWS * CELL_SIZE;
  const boardW = COLS * CELL_SIZE;

  const leftLen  = boardH;
  const topLen   = boardW;
  const rightLen = boardH;
  const total    = leftLen + topLen + rightLen;

  const dist = progress * total;

  // left edge: bottom → top (x = BOARD_LEFT - PATH_WIDTH/2, y goes from bottom to top)
  const leftX = BOARD_LEFT - PATH_WIDTH / 2;
  const rightX = BOARD_LEFT + boardW + PATH_WIDTH / 2;
  const topY   = BOARD_TOP - PATH_WIDTH / 2;
  const bottomY = BOARD_TOP + boardH;

  if (dist <= leftLen) {
    return { x: leftX, y: bottomY - dist };
  } else if (dist <= leftLen + topLen) {
    const d = dist - leftLen;
    return { x: BOARD_LEFT + d, y: topY };
  } else {
    const d = dist - leftLen - topLen;
    return { x: rightX, y: topY + d };
  }
}

// ---- Enemy configs ------------------------------------------

const ENEMY_CONFIGS: Record<EnemyType, Omit<Enemy, 'id' | 'pathProgress' | 'x' | 'y' | 'statusEffects'>> = {
  [EnemyType.NORMAL]: {
    type: EnemyType.NORMAL,
    hp: 80, maxHp: 80,
    speed: 0.025,         // ~40s to complete path (slowed for more reaction time)
    armor: 0,
    leakDamage: 1,
    immuneToStun: false,
    immuneToFreeze: false,
  },
  [EnemyType.ELITE]: {
    type: EnemyType.ELITE,
    hp: 220, maxHp: 220,
    speed: 0.018,
    armor: 0.25,
    leakDamage: 2,
    immuneToStun: false,
    immuneToFreeze: true,
  },
  [EnemyType.BOSS]: {
    type: EnemyType.BOSS,
    hp: 800, maxHp: 800,
    speed: 0.010,
    armor: 0.4,
    leakDamage: 5,
    immuneToStun: true,
    immuneToFreeze: true,
  },
};

let _eidCounter = 0;

function createEnemy(type: EnemyType): Enemy {
  const cfg = ENEMY_CONFIGS[type];
  const id = `e${_eidCounter++}`;
  const pos = getPathPosition(0);
  return {
    ...cfg,
    id,
    hp: cfg.hp,
    pathProgress: 0,
    statusEffects: [],
    x: pos.x,
    y: pos.y,
  };
}

// ---- EnemyManager -------------------------------------------

export class EnemyManager {
  enemies: Enemy[] = [];
  private _onLeak: (e: Enemy) => void;

  constructor(onLeak: (e: Enemy) => void) {
    this._onLeak = onLeak;
  }

  spawnEnemy(type: EnemyType = EnemyType.NORMAL): void {
    this.enemies.push(createEnemy(type));
  }

  /** Update all enemies by dt seconds */
  update(dt: number): void {
    for (const e of this.enemies) {
      const effectiveSpeed = this._getEffectiveSpeed(e, dt);
      e.pathProgress = Math.min(1, e.pathProgress + effectiveSpeed * dt);
      const pos = getPathPosition(e.pathProgress);
      e.x = pos.x;
      e.y = pos.y;

      // Tick status effects
      this._tickStatusEffects(e, dt);
    }

    // Check for enemies that reached the end
    const leaked = this.enemies.filter(e => e.pathProgress >= 1);
    for (const e of leaked) {
      this._onLeak(e);
    }
    this.enemies = this.enemies.filter(e => e.pathProgress < 1 && e.hp > 0);
  }

  private _getEffectiveSpeed(e: Enemy, _dt: number): number {
    for (const fx of e.statusEffects) {
      if (fx.type === StatusEffectType.FREEZE || fx.type === StatusEffectType.STUN) {
        return 0;
      }
      if (fx.type === StatusEffectType.SLOW) {
        return e.speed * (1 - (fx.value ?? 0.5));
      }
    }
    return e.speed;
  }

  private _tickStatusEffects(e: Enemy, dt: number): void {
    // FIRE DoT
    for (const fx of e.statusEffects) {
      if (fx.type === StatusEffectType.FIRE && fx.value !== undefined) {
        this.applyDamage(e, fx.value * dt);
      }
    }
    e.statusEffects = e.statusEffects
      .map(fx => ({ ...fx, remaining: fx.remaining - dt }))
      .filter(fx => fx.remaining > 0);
  }

  /** Apply damage to an enemy, respecting armor */
  applyDamage(enemy: Enemy, rawDamage: number): void {
    const armorMult = 1 - enemy.armor;
    const actual = rawDamage * armorMult;
    enemy.hp = Math.max(0, enemy.hp - actual);
    // Dead enemies are cleaned up after update loop
  }

  /** Apply armor-ignoring damage */
  applyTrueDamage(enemy: Enemy, damage: number): void {
    enemy.hp = Math.max(0, enemy.hp - damage);
  }

  addStatusEffect(enemy: Enemy, effect: StatusEffect): void {
    if (effect.type === StatusEffectType.FREEZE && enemy.immuneToFreeze) return;
    if (effect.type === StatusEffectType.STUN && enemy.immuneToStun) return;

    // Refresh if already present
    const existing = enemy.statusEffects.findIndex(fx => fx.type === effect.type);
    if (existing >= 0) {
      enemy.statusEffects[existing] = effect;
    } else {
      enemy.statusEffects.push(effect);
    }
  }

  /** Get enemies sorted by pathProgress descending (#1 = closest to end) */
  getSortedByProgress(): Enemy[] {
    return [...this.enemies].sort((a, b) => b.pathProgress - a.pathProgress);
  }

  /** Get enemy at path rank (0 = closest to end) */
  getTopEnemy(rank: number = 0): Enemy | null {
    const sorted = this.getSortedByProgress();
    return sorted[rank] ?? null;
  }

  removeEnemy(enemy: Enemy): void {
    this.enemies = this.enemies.filter(e => e.id !== enemy.id);
  }

  reset(): void {
    this.enemies = [];
    _eidCounter = 0;
  }
}

// ============================================================
// ELEMENTRIS — BulletSystem
// Handles bullet spawn, smart target selection, Bezier flight,
// crit multipliers and damage resolution
// ============================================================

import { Bullet, Enemy } from './types';
import {
  BASE_DAMAGE, CRIT_MULTIPLIERS, CRIT_COLORS,
  BULLET_FLIGHT_MS,
  BOARD_LEFT, BOARD_TOP, CELL_SIZE,
} from './constants';
import { EnemyManager } from './EnemyManager';

let _bidCounter = 0;

// Color/width for each crit tier
const CRIT_LINE_WIDTHS = [2, 3, 4, 5];

interface FloatingText {
  text: string;
  x: number;
  y: number;
  alpha: number;
  color: string;
  size: number;
  vy: number;
  life: number;
}

export class BulletSystem {
  bullets: Bullet[] = [];
  floatingTexts: FloatingText[] = [];
  private _enemyMgr: EnemyManager;
  private _onEnemyDamage: (enemy: Enemy, dmg: number) => void;
  amplifyRemaining: number = 0;  // kept for API compatibility, no longer functional

  constructor(enemyMgr: EnemyManager, onEnemyDamage: (enemy: Enemy, dmg: number) => void) {
    this._enemyMgr = enemyMgr;
    this._onEnemyDamage = onEnemyDamage;
  }

  /**
   * Fire bullets for a cleared row set.
   * @param clearedRowIndices  row indices that were cleared simultaneously
   * @param boardCellColors    array of colors for each row's cells (10 colors per row)
   * @param dmgMult            damage multiplier from passive skills (default 1)
   * @param extraBullets       extra bullets (additional target selections) per row
   */
  fireBulletsForRows(
    clearedRowIndices: number[],
    boardCellColors: string[][],
    dmgMult: number = 1,
    extraBullets: number = 0,
  ): void {
    const rowCount = clearedRowIndices.length;
    if (rowCount === 0) return;

    // Determine crit tier (0-indexed: 0=1row, 1=2row, 2=3row, 3=4row)
    const critTier = Math.min(rowCount - 1, 3);
    const critMult = CRIT_MULTIPLIERS[critTier] * dmgMult;

    const bulletColor = CRIT_COLORS[critTier];
    const lineWidth   = CRIT_LINE_WIDTHS[critTier];

    // Smart target selection for each row — track predicted remaining HP so
    // multiple simultaneous rows don't pile onto the same (soon-dead) enemy.
    // Also account for already in-flight bullets to avoid overkill.
    const predictedHp = new Map<string, number>();
    for (const e of this._enemyMgr.getSortedByProgress()) {
      predictedHp.set(e.id, e.hp);
    }
    // Deduct damage from bullets already in-flight
    for (const b of this.bullets) {
      const id = b.targetEnemy.id;
      if (predictedHp.has(id)) {
        predictedHp.set(id, Math.max(0, (predictedHp.get(id) ?? 0) - b.damage));
      }
    }

    for (let i = 0; i < clearedRowIndices.length; i++) {
      const rowIdx = clearedRowIndices[i];
      const rowDamageTotal = 10 * BASE_DAMAGE * critMult;

      const target = this._selectTarget(rowDamageTotal, predictedHp);
      if (!target) continue;

      const after = Math.max(0, (predictedHp.get(target.id) ?? 0) - rowDamageTotal);
      predictedHp.set(target.id, after);

      // Spawn bullets for each cell in this row
      for (let col = 0; col < 10; col++) {
        const cellX = BOARD_LEFT + col * CELL_SIZE + CELL_SIZE / 2;
        const cellY = BOARD_TOP + rowIdx * CELL_SIZE + CELL_SIZE / 2;
        const cpX = (cellX + target.x) / 2 + (Math.random() - 0.5) * 60;
        const cpY = Math.min(cellY, target.y) - 80 - Math.random() * 40;
        this.bullets.push({
          id: `b${_bidCounter++}`,
          startX: cellX, startY: cellY,
          controlX: cpX, controlY: cpY,
          targetEnemy: target,
          damage: BASE_DAMAGE * critMult,
          critMultiplier: critMult,
          progress: 0, color: bulletColor, lineWidth,
        });
      }

      // Extra bullets from multi_bullet passive
      for (let eb = 0; eb < extraBullets; eb++) {
        const extraTarget = this._selectTarget(BASE_DAMAGE * critMult, predictedHp) ?? target;
        const cellX = BOARD_LEFT + 5 * CELL_SIZE + CELL_SIZE / 2;
        const cellY = BOARD_TOP + rowIdx * CELL_SIZE + CELL_SIZE / 2;
        const cpX = (cellX + extraTarget.x) / 2 + (Math.random() - 0.5) * 60;
        const cpY = Math.min(cellY, extraTarget.y) - 80 - Math.random() * 40;
        this.bullets.push({
          id: `b${_bidCounter++}`,
          startX: cellX, startY: cellY,
          controlX: cpX, controlY: cpY,
          targetEnemy: extraTarget,
          damage: BASE_DAMAGE * critMult,
          critMultiplier: critMult,
          progress: 0, color: bulletColor, lineWidth,
        });
      }
    }

    // Show crit label
    if (rowCount >= 2) {
      const labels = ['', 'Double!', 'Triple!', 'TETRIS!'];
      this._spawnCritText(labels[critTier], critTier);
    }
  }

  /** Smart target selection: always attack the enemy closest to the exit that isn't already predicted-dead */
  private _selectTarget(_rowTotalDamage: number, predictedHp?: Map<string, number>): Enemy | null {
    const sorted = this._enemyMgr.getSortedByProgress();
    if (sorted.length === 0) return null;

    // Find the first enemy (closest to end) that isn't already predicted-dead by this batch
    for (const enemy of sorted) {
      const hp = predictedHp ? (predictedHp.get(enemy.id) ?? enemy.hp) : enemy.hp;
      if (hp <= 0) continue; // skip enemies already killed by earlier bullets in this batch
      return enemy;
    }
    return null;
  }

  update(dt: number): void {
    const flightSec = BULLET_FLIGHT_MS / 1000;
    const step = dt / flightSec;

    const done: Bullet[] = [];
    for (const b of this.bullets) {
      b.progress = Math.min(1, b.progress + step);
      if (b.progress >= 1) done.push(b);
    }

    // Resolve damage for completed bullets
    for (const b of done) {
      const enemy = this._enemyMgr.enemies.find(e => e.id === b.targetEnemy.id);
      if (enemy && enemy.hp > 0) {
        this._onEnemyDamage(enemy, b.damage);
      }
    }
    this.bullets = this.bullets.filter(b => b.progress < 1);

    // Update floating texts
    for (const ft of this.floatingTexts) {
      ft.y += ft.vy * dt;
      ft.alpha = Math.max(0, ft.life / 1.5);
      ft.life = Math.max(0, ft.life - dt);
    }
    this.floatingTexts = this.floatingTexts.filter(ft => ft.life > 0);
  }

  private _spawnCritText(text: string, tier: number): void {
    this.floatingTexts.push({
      text,
      x: BOARD_LEFT + (10 * CELL_SIZE) / 2,
      y: BOARD_TOP + (20 * CELL_SIZE) / 2,
      alpha: 1,
      color: CRIT_COLORS[tier],
      size: 24 + tier * 10,
      vy: -60,
      life: 1.5,
    });
  }

  /** Get current bullet position using quadratic Bezier */
  getBulletPos(b: Bullet): { x: number; y: number } {
    const t = b.progress;
    const mt = 1 - t;
    // target position (enemy may have moved)
    const ex = b.targetEnemy.x;
    const ey = b.targetEnemy.y;
    const x = mt * mt * b.startX + 2 * mt * t * b.controlX + t * t * ex;
    const y = mt * mt * b.startY + 2 * mt * t * b.controlY + t * t * ey;
    return { x, y };
  }

  reset(): void {
    this.bullets = [];
    this.floatingTexts = [];
    this.amplifyRemaining = 0;
  }
}

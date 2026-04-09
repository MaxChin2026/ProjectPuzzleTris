// ============================================================
// ELEMENTRIS — GameController
// Central state machine, update loop, event coordination
// ============================================================

import { GameState, EnemyType, ElementType, Enemy } from './types';
import {
  COLS, ROWS, BASE_DAMAGE,
  WAVE_SIZE_BASE, INTRA_WAVE_DELAY_MS, INTER_WAVE_DELAY_MS, ELEMENT_TYPES,
} from './constants';
import { BoardManager } from './BoardManager';
import { BlockManager } from './BlockManager';
import { EnemyManager } from './EnemyManager';
import { BulletSystem } from './BulletSystem';
import { SkillManager, SkillContext } from './SkillManager';

export class GameController {
  state: GameState = GameState.IDLE;
  playerHp: number = 15;
  maxHp: number = 15;
  score: number = 0;
  wave: number = 1;

  board: BoardManager;
  blocks: BlockManager;
  enemies: EnemyManager;
  bullets: BulletSystem;
  skills: SkillManager;

  private _enemySpawnTimer: number = 0;
  private _lastTime: number = 0;
  private _raf: number = 0;

  // Wave state
  private _waveEnemiesLeft: number = 0;
  private _betweenWave: boolean = true;   // true = inter-wave cooldown, false = spawning wave

  // Shared refs for skill context
  private _playerHpRef = { value: 15 };

  // Callbacks
  onStateChange?: (state: GameState) => void;
  onRowsCleared?: (count: number) => void;

  constructor() {
    this.skills  = new SkillManager();
    this.board   = new BoardManager();
    this.blocks  = new BlockManager(this.board);
    this.enemies = new EnemyManager(this._onEnemyLeak.bind(this));
    this.bullets = new BulletSystem(this.enemies, this._onEnemyDamage.bind(this));
  }

  start(): void {
    if (this.state !== GameState.IDLE) return;
    this._resetAll();
    this.state = GameState.PLAYING;
    this.blocks.refillSlots();
    // Spawn first enemy
    this.enemies.spawnEnemy(EnemyType.NORMAL);
    this._lastTime = performance.now();
    this._raf = requestAnimationFrame(this._loop.bind(this));
    this.onStateChange?.(this.state);
  }

  pause(): void {
    if (this.state !== GameState.PLAYING) return;
    this.state = GameState.PAUSED;
    cancelAnimationFrame(this._raf);
    this.onStateChange?.(this.state);
  }

  resume(): void {
    if (this.state !== GameState.PAUSED) return;
    this.state = GameState.PLAYING;
    this._lastTime = performance.now();
    this._raf = requestAnimationFrame(this._loop.bind(this));
    this.onStateChange?.(this.state);
  }

  restart(): void {
    cancelAnimationFrame(this._raf);
    this.state = GameState.IDLE;
    this.start();
  }

  private _resetAll(): void {
    this.playerHp = 15;
    this._playerHpRef.value = 15;
    this.score = 0;
    this.wave = 1;
    this.board.reset();
    this.blocks.reset();
    this.enemies.reset();
    this.bullets.reset();
    this.skills.reset();
    this._enemySpawnTimer = 0;
    this._waveEnemiesLeft = 0;
    this._betweenWave = true;
  }

  private _loop(now: number): void {
    if (this.state !== GameState.PLAYING) return;
    const dt = Math.min((now - this._lastTime) / 1000, 0.1); // cap at 100ms
    this._lastTime = now;
    this._update(dt);
    this._raf = requestAnimationFrame(this._loop.bind(this));
  }

  private _update(dt: number): void {
    // Update enemies
    this.enemies.update(dt);

    // Update bullets
    this.bullets.update(dt);

    // Enemy wave spawning
    this._enemySpawnTimer += dt * 1000;
    if (this._betweenWave) {
      // Inter-wave cooldown: decreases with wave number (min 6s)
      const interDelay = Math.max(6000, INTER_WAVE_DELAY_MS - (this.wave - 1) * 200);
      if (this._enemySpawnTimer >= interDelay) {
        this._enemySpawnTimer = 0;
        this._betweenWave = false;
        this._waveEnemiesLeft = Math.min(12, WAVE_SIZE_BASE + Math.floor((this.wave - 1) / 2));
        this.wave++;
      }
    } else {
      // Intra-wave: spawn enemies with short interval (min 300ms)
      const intraDelay = Math.max(300, INTRA_WAVE_DELAY_MS - (this.wave - 1) * 20);
      if (this._enemySpawnTimer >= intraDelay) {
        this._enemySpawnTimer = 0;
        this._spawnNextEnemy();
        this._waveEnemiesLeft--;
        if (this._waveEnemiesLeft <= 0) {
          this._betweenWave = true; // wave done, start inter-wave cooldown
        }
      }
    }

    // Sync player HP
    this.playerHp = this._playerHpRef.value;
  }

  private _spawnNextEnemy(): void {
    let type = EnemyType.NORMAL;
    if (this.score > 500) type = Math.random() < 0.3 ? EnemyType.ELITE : EnemyType.NORMAL;
    if (this.score > 2000) type = Math.random() < 0.05 ? EnemyType.BOSS : type;
    this.enemies.spawnEnemy(type);
  }

  // ---- Block placement API (called from InputManager) ----

  selectSlot(index: number): boolean {
    return this.blocks.selectSlot(index);
  }

  placeActiveAt(col: number): boolean {
    if (!this.blocks.active || this.state !== GameState.PLAYING) return false;
    // Move active block to target column
    const target = col - this.blocks.active.col;
    for (let i = 0; i < Math.abs(target); i++) {
      this.blocks.moveActive(0, target > 0 ? 1 : -1);
    }
    return true;
  }

  dropActive(): void {
    if (!this.blocks.active || this.state !== GameState.PLAYING) return;
    this.blocks.hardDrop();
    this._lockAndProcess();
  }

  cancelActive(): void {
    if (this.state !== GameState.PLAYING) return;
    this.blocks.cancelActive();
  }

  private _lockAndProcess(): void {
    if (!this.blocks.active) return;

    // Lock block
    this.blocks.lockActive();

    // Check game over
    if (this.board.isTopBlocked()) {
      this._gameOver();
      return;
    }

    // Check and clear rows
    const result = this.board.checkAndClearRows();

    if (result.clearedRows.length > 0) {
      this._handleClear(result);
    }

    // Score for placement
    this.score += 5;

    // Refill empty slots
    this.blocks.refillSlots();
  }

  private _handleClear(result: ReturnType<BoardManager['checkAndClearRows']>): void {
    const rowCount = result.clearedRows.length;
    this.onRowsCleared?.(rowCount);

    // Score
    const scoreMap = [0, 100, 250, 500, 1000];
    this.score += scoreMap[Math.min(rowCount, 4)];

    // Accumulate element energy from cleared cells
    for (const el of ELEMENT_TYPES) {
      if (result.energyGained[el] > 0) {
        this.skills.addEnergy(el, result.energyGained[el]);
      }
    }

    // All cleared rows fire bullets
    if (result.clearedRows.length > 0) {
      const colors = result.clearedRows.map(() => Array(10).fill('#8ab4ff'));
      this.bullets.fireBulletsForRows(result.clearedRows, colors);
    }
  }

  /** Called from InputManager when player taps a skill icon */
  useSkill(el: ElementType): boolean {
    if (this.state !== GameState.PLAYING) return false;
    const ctx: SkillContext = {
      enemies: this.enemies.enemies,
      onEnemyDamage: this._onEnemyDamage.bind(this),
      onEnemyPositionSet: (enemy, p) => { enemy.pathProgress = Math.max(0, p); },
    };
    return this.skills.useSkill(el, ctx);
  }

  private _onEnemyDamage(enemy: Enemy, dmg: number): void {
    this.enemies.applyDamage(enemy, dmg);
    if (enemy.hp <= 0) {
      this.score += 50;
      this.enemies.removeEnemy(enemy);
    }
  }

  private _onEnemyLeak(enemy: Enemy): void {
    this._playerHpRef.value = Math.max(0, this._playerHpRef.value - enemy.leakDamage);
    this.playerHp = this._playerHpRef.value;
    if (this.playerHp <= 0) {
      this._gameOver();
    }
  }

  private _gameOver(): void {
    this.state = GameState.GAME_OVER;
    cancelAnimationFrame(this._raf);
    this.onStateChange?.(this.state);
  }

  // Called from InputManager for touch/drag
  moveActiveTo(col: number): void {
    if (!this.blocks.active || this.state !== GameState.PLAYING) return;
    const target = col - this.blocks.active.col;
    this.blocks.moveActive(0, target > 0 ? 1 : -1);
  }

  setActiveCol(col: number): void {
    if (!this.blocks.active) return;
    const diff = col - this.blocks.active.col;
    if (diff !== 0) this.blocks.moveActive(0, diff > 0 ? 1 : -1);
  }
}

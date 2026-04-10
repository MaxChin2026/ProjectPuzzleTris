// ============================================================
// ELEMENTRIS - GameController
// Central state machine, update loop, event coordination.
// Tetris-style gravity: one block falls from the top at a time.
// Hero XP from line clears -> hero levels up -> LEVEL_UP state.
// ============================================================

import { GameState, EnemyType, ElementType, Enemy, PassiveSkillDef, PassiveSkillId } from './types';
import {
  COLS, ROWS,
  WAVE_SIZE_BASE, INTRA_WAVE_DELAY_MS, INTER_WAVE_DELAY_MS, ELEMENT_TYPES,
  FALL_START_INTERVAL_MS, SOFT_DROP_INTERVAL_MS,
  LOCK_DELAY_MS,
  HERO_BASE_XP, HERO_XP_MULTIPLIER, HERO_XP_TABLE,
} from './constants';
import { BoardManager } from './BoardManager';
import { BlockManager } from './BlockManager';
import { EnemyManager } from './EnemyManager';
import { BulletSystem } from './BulletSystem';
import { SkillManager, SkillContext } from './SkillManager';

// ---- Passive skill library ----------------------------------

const PASSIVE_SKILL_POOL: PassiveSkillDef[] = [
  { id: 'dmg_up',        name: '\u706b\u529b\u5f3a\u5316',   desc: '\u5b50\u5f39\u4f24\u5bb3 +30%',                    element: 'neutral',   icon: '\ud83d\udca5' },
  { id: 'fire_dmg',      name: '\u70c8\u5f70\u5347\u534e',   desc: '\u706b\u7130\u6280\u80fd\u4f24\u5bb3 x2',           element: 'fire',      icon: '\ud83d\udd25' },
  { id: 'fire_zone_dot', name: '\u7126\u571f\u6218\u573a',   desc: '\u706b\u7130\u533a\u57df\u71c3\u70e7\u4f24\u5bb3 +50%', element: 'fire', icon: '\ud83c\udf0b' },
  { id: 'lightning_dmg', name: '\u96f7\u9706\u4e07\u9f88',   desc: '\u95ea\u7535\u94fe\u51fb +2 \u76ee\u6807\uff0c\u4f24\u5bb3 x1.5', element: 'lightning', icon: '\u26a1' },
  { id: 'chain_bolt',    name: '\u5206\u53c9\u95ea\u7535',   desc: '\u95ea\u7535\u5bf9\u6bcf\u4e2a\u76ee\u6807\u518d\u6b21\u5206\u53c9\u4f24\u5bb3', element: 'lightning', icon: '\ud83c\udf29\ufe0f' },
  { id: 'frost_dur',     name: '\u6781\u5bd2\u6c38\u51bb',   desc: '\u51b0\u971c\u51bb\u7ed3\u65f6\u957f +3 \u79d2',    element: 'frost',     icon: '\u2744\ufe0f' },
  { id: 'blizzard',      name: '\u66b4\u98ce\u96ea',         desc: '\u51b0\u971c\u540c\u65f6\u51cf\u901f\u672a\u51bb\u7ed3\u656c\u4eba 70%', element: 'frost', icon: '\ud83c\udf28\ufe0f' },
  { id: 'hurricane_kb',  name: '\u5f3a\u529b\u98d9\u98ce',   desc: '\u98d9\u98ce +2 \u76ee\u6807\uff0c\u51fb\u9000\u8ddd\u79bb x1.5', element: 'hurricane', icon: '\ud83c\udf2a\ufe0f' },
  { id: 'cyclone',       name: '\u9f99\u5377\u98ce\u773c',   desc: '\u98d9\u98ce\u5bf9\u8def\u5f84\u4e0a\u6240\u6709\u656c\u4eba\u9020\u6210\u4f24\u5bb3', element: 'hurricane', icon: '\ud83c\udf00' },
  { id: 'multi_clear',   name: '\u8fde\u9501\u6d88\u9664',   desc: '\u6d88\u884c\u65f6\u89e6\u53d1\u989d\u5916\u4e00\u6b21\u5b50\u5f39\u9f50\u5c04', element: 'neutral', icon: '\ud83d\udcab' },
  { id: 'energy_eff',    name: '\u80fd\u91cf\u5171\u9f23',   desc: '\u6280\u80fd\u80fd\u91cf\u6d88\u8017\u51cf\u5c11 25%', element: 'neutral', icon: '\ud83d\udd0b' },
  { id: 'hp_regen',      name: '\u751f\u547d\u56de\u6cc9',   desc: '\u6bcf\u6d88\u9664\u4e00\u884c\u6062\u590d 1 HP',   element: 'neutral',   icon: '\ud83d\udc9a' },
  { id: 'wave_slow',     name: '\u65f6\u95f4\u4e4b\u6d77',   desc: '\u6240\u6709\u656c\u4eba\u901f\u5ea6\u964d\u4f4e 15%', element: 'neutral', icon: '\u231b' },
  { id: 'crit_chance',   name: '\u66b4\u51fb\u8fde\u53d1',   desc: '\u66b4\u51fb\u7387 +20%',                           element: 'neutral',   icon: '\ud83c\udfaf' },
];

function pickSkillOptions(taken: PassiveSkillId[]): PassiveSkillDef[] {
  const pool = PASSIVE_SKILL_POOL.filter(s => !taken.includes(s.id));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

// ---- GameController ------------------------------------------

export class GameController {
  state: GameState = GameState.IDLE;
  playerHp: number = 15;
  maxHp: number = 15;
  score: number = 0;
  wave: number = 1;

  // Hero system
  heroLevel: number = 1;
  heroXp: number = 0;
  heroXpNeeded: number = HERO_BASE_XP;
  passiveSkills: PassiveSkillId[] = [];
  levelUpOptions: PassiveSkillDef[] = [];

  // Tetris gravity
  private _fallTimer: number = 0;
  private _fallInterval: number = FALL_START_INTERVAL_MS;
  private _softDrop: boolean = false;
  private _lockTimer: number = 0;
  private _lockActive: boolean = false;

  board: BoardManager;
  blocks: BlockManager;
  enemies: EnemyManager;
  bullets: BulletSystem;
  skills: SkillManager;

  private _enemySpawnTimer: number = 0;
  private _lastTime: number = 0;
  private _raf: number = 0;

  private _waveEnemiesLeft: number = 0;
  private _betweenWave: boolean = true;

  bulletDmgMult: number = 1;
  critBonus: number = 0;

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
    this.maxHp = 15;
    this.score = 0;
    this.wave = 1;
    this.heroLevel = 1;
    this.heroXp = 0;
    this.heroXpNeeded = HERO_BASE_XP;
    this.passiveSkills = [];
    this.levelUpOptions = [];
    this.bulletDmgMult = 1;
    this.critBonus = 0;
    this.board.reset();
    this.blocks.reset();
    this.enemies.reset();
    this.bullets.reset();
    this.skills.reset();
    this._enemySpawnTimer = 0;
    this._waveEnemiesLeft = 0;
    this._betweenWave = true;
    this._fallTimer = 0;
    this._fallInterval = FALL_START_INTERVAL_MS;
    this._softDrop = false;
    this._lockTimer = 0;
    this._lockActive = false;
  }

  private _loop(now: number): void {
    if (this.state !== GameState.PLAYING) return;
    const dt = Math.min((now - this._lastTime) / 1000, 0.1);
    this._lastTime = now;
    this._update(dt);
    this._raf = requestAnimationFrame(this._loop.bind(this));
  }

  private _update(dt: number): void {
    this.enemies.update(dt);
    this.bullets.update(dt);
    this.skills.updateEffects(dt);
    this._tickFireZoneDamage(dt);
    this._tickWaveSpawn(dt);
    this._tickGravity(dt);
  }

  /** Apply DOT from fire zones to enemies that are inside them */
  private _tickFireZoneDamage(dt: number): void {
    for (const fz of this.skills.effects.fireZones) {
      for (const e of this.enemies.enemies) {
        const dx = e.x - fz.x;
        const dy = e.y - fz.y;
        if (dx * dx + dy * dy <= fz.r * fz.r) {
          this._onEnemyDamage(e, fz.dotDamage * dt);
        }
      }
    }
  }

  private _tickGravity(dt: number): void {
    if (!this.blocks.active) return;
    const interval = this._softDrop ? SOFT_DROP_INTERVAL_MS : this._fallInterval;
    this._fallTimer += dt * 1000;

    if (this.blocks.canMoveDown()) {
      this._lockActive = false;
      if (this._fallTimer >= interval) {
        this._fallTimer = 0;
        this.blocks.moveActive(1, 0);
      }
    } else {
      if (!this._lockActive) {
        this._lockActive = true;
        this._lockTimer = 0;
      }
      this._fallTimer = 0;
      this._lockTimer += dt * 1000;
      if (this._lockTimer >= LOCK_DELAY_MS) {
        this._doLockAndProcess();
      }
    }
  }

  private _tickWaveSpawn(dt: number): void {
    this._enemySpawnTimer += dt * 1000;
    if (this._betweenWave) {
      const interDelay = Math.max(6000, INTER_WAVE_DELAY_MS - (this.wave - 1) * 200);
      if (this._enemySpawnTimer >= interDelay) {
        this._enemySpawnTimer = 0;
        this._betweenWave = false;
        this._waveEnemiesLeft = Math.min(12, WAVE_SIZE_BASE + Math.floor((this.wave - 1) / 2));
        this.wave++;
      }
    } else {
      const intraDelay = Math.max(300, INTRA_WAVE_DELAY_MS - (this.wave - 1) * 20);
      if (this._enemySpawnTimer >= intraDelay) {
        this._enemySpawnTimer = 0;
        this._spawnNextEnemy();
        this._waveEnemiesLeft--;
        if (this._waveEnemiesLeft <= 0) this._betweenWave = true;
      }
    }
  }

  private _spawnNextEnemy(): void {
    let type = EnemyType.NORMAL;
    if (this.score > 500) type = Math.random() < 0.3 ? EnemyType.ELITE : EnemyType.NORMAL;
    if (this.score > 2000) type = Math.random() < 0.05 ? EnemyType.BOSS : type;
    this.enemies.spawnEnemy(type);
  }

  // ---- Input actions ----

  moveLeft(): void {
    if (this.state !== GameState.PLAYING) return;
    this.blocks.moveActive(0, -1);
    this._lockTimer = 0; // reset lock on move
  }

  moveRight(): void {
    if (this.state !== GameState.PLAYING) return;
    this.blocks.moveActive(0, 1);
    this._lockTimer = 0;
  }

  setSoftDrop(on: boolean): void {
    this._softDrop = on;
  }

  softDrop(): void {
    if (this.state !== GameState.PLAYING) return;
    if (this.blocks.canMoveDown()) {
      this.blocks.moveActive(1, 0);
      this._fallTimer = 0;
    }
  }

  hardDrop(): void {
    if (this.state !== GameState.PLAYING || !this.blocks.active) return;
    this.blocks.hardDrop();
    this._doLockAndProcess();
  }

  rotate(): void {
    if (this.state !== GameState.PLAYING) return;
    if (this.blocks.rotate()) {
      this._lockTimer = 0; // reset lock on rotate
    }
  }

  // ---- Level-up skill selection ----

  selectPassiveSkill(index: number): void {
    if (this.state !== GameState.LEVEL_UP) return;
    const chosen = this.levelUpOptions[index];
    if (!chosen) return;
    this.passiveSkills.push(chosen.id);
    this._applyPassive(chosen.id);
    this.levelUpOptions = [];
    this.state = GameState.PLAYING;
    this._lastTime = performance.now();
    this._raf = requestAnimationFrame(this._loop.bind(this));
    this.onStateChange?.(this.state);
  }

  private _applyPassive(id: PassiveSkillId): void {
    switch (id) {
      case 'dmg_up':        this.bulletDmgMult += 0.3; break;
      case 'crit_chance':   this.critBonus += 0.2; break;
      case 'wave_slow':
        for (const e of this.enemies.enemies) e.speed *= 0.85;
        break;
      case 'hp_regen':      break; // handled in _handleClear
      case 'energy_eff':    this.skills.energyCostMult = Math.max(0.25, (this.skills.energyCostMult ?? 1) - 0.25); break;
      case 'fire_dmg':      this.skills.fireMultiplier = (this.skills.fireMultiplier ?? 1) * 2; break;
      case 'fire_zone_dot': this.skills.fireZoneDotBonus = (this.skills.fireZoneDotBonus ?? 0) + 0.5; break;
      case 'lightning_dmg': this.skills.lightningMult = (this.skills.lightningMult ?? 1) * 1.5;
                            this.skills.lightningTargets = (this.skills.lightningTargets ?? 5) + 2; break;
      case 'chain_bolt':    this.skills.chainBolt = true; break;
      case 'frost_dur':     this.skills.frostDurBonus = (this.skills.frostDurBonus ?? 0) + 3; break;
      case 'blizzard':      this.skills.blizzard = true; break;
      case 'hurricane_kb':  this.skills.hurricaneTargets = (this.skills.hurricaneTargets ?? 3) + 2;
                            this.skills.hurricaneKbMult = (this.skills.hurricaneKbMult ?? 1) * 1.5; break;
      case 'cyclone':       this.skills.cyclone = true; break;
      case 'multi_clear':   this.skills.multiClear = true; break;
    }
  }

  // ---- Skill usage ----

  useSkill(el: ElementType): boolean {
    if (this.state !== GameState.PLAYING) return false;
    const ctx: SkillContext = {
      enemies: this.enemies.enemies,
      onEnemyDamage: this._onEnemyDamage.bind(this),
      onEnemyPositionSet: (enemy, p) => { enemy.pathProgress = Math.max(0, p); },
      getPathPos: this.enemies.getPathPos.bind(this.enemies),
    };
    return this.skills.useSkill(el, ctx);
  }

  // ---- Lock and process ----

  private _doLockAndProcess(): void {
    if (!this.blocks.active) return;
    this.blocks.lockActive();
    this._lockActive = false;
    this._lockTimer = 0;
    this._fallTimer = 0;

    if (this.board.isTopBlocked()) {
      this._gameOver();
      return;
    }

    const result = this.board.checkAndClearRows();
    if (result.clearedRows.length > 0) {
      this._handleClear(result);
    }

    this.score += 5;
    this.blocks.spawnNext();
  }

  private _handleClear(result: ReturnType<BoardManager['checkAndClearRows']>): void {
    const rowCount = result.clearedRows.length;
    this.onRowsCleared?.(rowCount);

    const scoreMap = [0, 100, 250, 500, 1000];
    this.score += scoreMap[Math.min(rowCount, 4)];

    const xp = HERO_XP_TABLE[Math.min(rowCount, 4)] ?? 0;
    this._gainHeroXp(xp);

    for (const el of ELEMENT_TYPES) {
      if (result.energyGained[el] > 0) {
        this.skills.addEnergy(el, result.energyGained[el]);
      }
    }

    if (result.clearedRows.length > 0) {
      this.bullets.fireBulletsForRows(result.clearedRows, result.clearedRows.map(() => Array(COLS).fill('#8ab4ff')), this.bulletDmgMult, this.critBonus);
    }

    if (this.skills.multiClear) {
      this.bullets.fireBulletsForRows(result.clearedRows, result.clearedRows.map(() => Array(COLS).fill('#ffffaa')), this.bulletDmgMult * 0.5, this.critBonus);
    }

    if (this.passiveSkills.includes('hp_regen')) {
      this.playerHp = Math.min(this.maxHp, this.playerHp + rowCount);
    }
  }

  private _gainHeroXp(xp: number): void {
    this.heroXp += xp;
    while (this.heroXp >= this.heroXpNeeded) {
      this.heroXp -= this.heroXpNeeded;
      this.heroLevel++;
      this.heroXpNeeded = Math.floor(HERO_BASE_XP * Math.pow(HERO_XP_MULTIPLIER, this.heroLevel - 1));
      this._triggerLevelUp();
    }
  }

  private _triggerLevelUp(): void {
    this.levelUpOptions = pickSkillOptions(this.passiveSkills);
    this.state = GameState.LEVEL_UP;
    cancelAnimationFrame(this._raf);
    this.onStateChange?.(this.state);
  }

  private _onEnemyDamage(enemy: Enemy, dmg: number): void {
    this.enemies.applyDamage(enemy, dmg);
    if (enemy.hp <= 0) {
      this.score += 50;
      this.enemies.removeEnemy(enemy);
    }
  }

  private _onEnemyLeak(enemy: Enemy): void {
    this.playerHp = Math.max(0, this.playerHp - enemy.leakDamage);
    if (this.playerHp <= 0) this._gameOver();
  }

  private _gameOver(): void {
    this.state = GameState.GAME_OVER;
    cancelAnimationFrame(this._raf);
    this.onStateChange?.(this.state);
  }
}


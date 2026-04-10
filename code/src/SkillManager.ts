// ============================================================
// ELEMENTRIS — SkillManager
// Manages 4 element energy pools: fire / lightning / frost / hurricane.
// Energy accumulates by clearing cells of the matching element color.
// Greatly enhanced visual effects for all skills.
// ============================================================

import { ElementType, Enemy, StatusEffectType } from './types';
import { ELEMENT_TYPES, ELEMENT_COLORS, SKILL_ENERGY_PER_CHARGE, BASE_DAMAGE } from './constants';

export interface SkillContext {
  enemies: Enemy[];
  onEnemyDamage: (enemy: Enemy, dmg: number) => void;
  onEnemyPositionSet: (enemy: Enemy, progress: number) => void;
  getPathPos: (progress: number) => { x: number; y: number };
}

export interface ElementSkill {
  element: ElementType;
  name: string;
  icon: string;
  color: string;
  energy: number;
}

// ---- Visual Effect Types ------------------------------------

export interface FireZone {
  x: number; y: number; r: number;      // burn zone circle
  remainingTime: number;
  maxTime: number;
  dotDamage: number;                     // damage per second
}

export interface LightningBolt {
  fromX: number; fromY: number;
  toX: number; toY: number;
  alpha: number;                         // 0-1 fade out
  branches: Array<{ x1: number; y1: number; x2: number; y2: number; alpha: number }>;
  flashTimer: number;                    // time since creation (flicker)
}

export interface HurricaneParticle {
  x: number; y: number;
  progress: number;                      // path progress this particle is at
  alpha: number;
  size: number;
}

export interface HurricaneEffect {
  startProgress: number;               // farthest pushed progress
  endProgress: number;                 // original enemy progress (effect moves toward start)
  currentProgress: number;            // current visual sweep position
  speed: number;
  active: boolean;
}

// ---- Skill visual effect state ------------------------------

export interface SkillEffects {
  fireZones: FireZone[];
  lightningBolts: LightningBolt[];
  hurricaneParticles: HurricaneParticle[];
  hurricaneEffects: HurricaneEffect[];
  frostFlash: number;                    // alpha for full-screen frost flash (0-1)
}

const SKILL_DEFS: Record<ElementType, Pick<ElementSkill, 'name' | 'icon'>> = {
  fire:      { name: '火焰', icon: '??' },
  lightning: { name: '闪电', icon: '?' },
  frost:     { name: '冰霜', icon: '??' },
  hurricane: { name: '飓风', icon: '???' },
};

export class SkillManager {
  private _skills: Map<ElementType, ElementSkill>;

  // Visual effects state (read by Renderer)
  effects: SkillEffects = {
    fireZones: [],
    lightningBolts: [],
    hurricaneParticles: [],
    hurricaneEffects: [],
    frostFlash: 0,
  };

  // Passive modifiers (set by GameController._applyPassive)
  energyCostMult: number = 1;
  fireMultiplier: number = 1;
  fireZoneDotBonus: number = 0;
  lightningMult: number = 1;
  lightningTargets: number = 5;
  chainBolt: boolean = false;
  frostDurBonus: number = 0;
  blizzard: boolean = false;
  hurricaneTargets: number = 3;
  hurricaneKbMult: number = 1;
  cyclone: boolean = false;
  multiClear: boolean = false;

  constructor() {
    this._skills = new Map();
    for (const el of ELEMENT_TYPES) {
      this._skills.set(el, {
        element: el,
        name: SKILL_DEFS[el].name,
        icon: SKILL_DEFS[el].icon,
        color: ELEMENT_COLORS[el],
        energy: 0,
      });
    }
  }

  getSkill(el: ElementType): ElementSkill {
    return this._skills.get(el)!;
  }

  get all(): ElementSkill[] {
    return ELEMENT_TYPES.map(el => this._skills.get(el)!);
  }

  addEnergy(el: ElementType, cells: number): void {
    this._skills.get(el)!.energy += cells;
  }

  /** Cost in raw energy for 1 charge (modified by energy_eff passive) */
  private get _cost(): number {
    return Math.round(SKILL_ENERGY_PER_CHARGE * this.energyCostMult);
  }

  getCharges(el: ElementType): number {
    return Math.floor(this._skills.get(el)!.energy / this._cost);
  }

  getPartialProgress(el: ElementType): number {
    const cost = this._cost;
    return (this._skills.get(el)!.energy % cost) / cost;
  }

  useSkill(el: ElementType, ctx: SkillContext): boolean {
    if (this.getCharges(el) < 1) return false;
    this._skills.get(el)!.energy -= this._cost;
    this._execute(el, ctx);
    return true;
  }

  // ---- Update visual effects each frame ----

  updateEffects(dt: number): void {
    // Fire zones: tick and remove expired
    for (const fz of this.effects.fireZones) {
      fz.remainingTime -= dt;
    }
    this.effects.fireZones = this.effects.fireZones.filter(z => z.remainingTime > 0);

    // Lightning bolts: fade out
    for (const bolt of this.effects.lightningBolts) {
      bolt.alpha -= dt * 3;             // fades in ~0.33s
      bolt.flashTimer += dt;
    }
    this.effects.lightningBolts = this.effects.lightningBolts.filter(b => b.alpha > 0);

    // Hurricane effects: sweep from end toward start
    for (const he of this.effects.hurricaneEffects) {
      if (he.active) {
        he.currentProgress -= he.speed * dt;
        if (he.currentProgress <= he.startProgress) {
          he.active = false;
        }
      }
    }
    this.effects.hurricaneEffects = this.effects.hurricaneEffects.filter(h => h.active || h.currentProgress > h.startProgress - 0.01);

    // Frost flash
    if (this.effects.frostFlash > 0) {
      this.effects.frostFlash -= dt * 2;
      if (this.effects.frostFlash < 0) this.effects.frostFlash = 0;
    }
  }

  private _execute(el: ElementType, ctx: SkillContext): void {
    const sorted = () => [...ctx.enemies].sort((a, b) => b.pathProgress - a.pathProgress);

    switch (el) {
      case 'fire': {
        // 火焰：对所有敌人施加强力火焰DoT（每秒30伤害×倍率，持续6秒）
        // 同时在所有敌人位置留下红色燃烧区域（持续可见且继续伤害经过的敌人）
        const fireDot = BASE_DAMAGE * 3 * this.fireMultiplier;
        const fireDur = 6;
        const zoneDot = BASE_DAMAGE * (1 + this.fireZoneDotBonus) * this.fireMultiplier;

        for (const e of ctx.enemies) {
          const existing = e.statusEffects.findIndex(fx => fx.type === StatusEffectType.FIRE);
          const newFx = { type: StatusEffectType.FIRE, remaining: fireDur, value: fireDot };
          if (existing >= 0) e.statusEffects[existing] = newFx;
          else e.statusEffects.push(newFx);

          // Leave a burn zone at enemy position
          this.effects.fireZones.push({
            x: e.x, y: e.y,
            r: 30,
            remainingTime: fireDur + 2,
            maxTime: fireDur + 2,
            dotDamage: zoneDot,
          });
        }

        // If no enemies, still create a centered zone on the path
        if (ctx.enemies.length === 0) {
          const pos = ctx.getPathPos(0.5);
          this.effects.fireZones.push({
            x: pos.x, y: pos.y, r: 40,
            remainingTime: 8, maxTime: 8, dotDamage: zoneDot,
          });
        }
        break;
      }

      case 'lightning': {
        // 闪电：链击最多N个最靠近终点的敌人，有黄色闪烁落雷效果
        const targets = sorted().slice(0, this.lightningTargets);
        const baseDmgs = [8, 6, 4, 2, 1, 1, 1];
        for (let i = 0; i < targets.length; i++) {
          const dmg = BASE_DAMAGE * (baseDmgs[i] ?? 1) * this.lightningMult;
          ctx.onEnemyDamage(targets[i], dmg);

          // Create a lightning bolt from sky to enemy
          const skyX = targets[i].x + (Math.random() - 0.5) * 20;
          const skyY = 0;
          const bolt = this._makeLightningBolt(skyX, skyY, targets[i].x, targets[i].y);
          this.effects.lightningBolts.push(bolt);

          // chain_bolt: extra bolt from previous to next
          if (this.chainBolt && i > 0) {
            const chainBolt = this._makeLightningBolt(
              targets[i - 1].x, targets[i - 1].y,
              targets[i].x, targets[i].y
            );
            chainBolt.alpha = 0.7;
            this.effects.lightningBolts.push(chainBolt);
          }
        }
        break;
      }

      case 'frost': {
        // 冰霜：冻结所有敌人，蓝色闪光效果
        const freezeDur = 4 + this.frostDurBonus;
        for (const e of ctx.enemies) {
          if (!e.immuneToFreeze) {
            const existing = e.statusEffects.findIndex(fx => fx.type === StatusEffectType.FREEZE);
            const newFx = { type: StatusEffectType.FREEZE, remaining: freezeDur };
            if (existing >= 0) e.statusEffects[existing] = newFx;
            else e.statusEffects.push(newFx);
          } else {
            const existing = e.statusEffects.findIndex(fx => fx.type === StatusEffectType.SLOW);
            const newFx = { type: StatusEffectType.SLOW, remaining: freezeDur + 2, value: 0.7 };
            if (existing >= 0) e.statusEffects[existing] = newFx;
            else e.statusEffects.push(newFx);
          }
          // blizzard: slow non-immune
          if (this.blizzard && !e.immuneToFreeze) {
            const slowFx = { type: StatusEffectType.SLOW, remaining: freezeDur, value: 0.7 };
            e.statusEffects.push(slowFx);
          }
        }
        // Visual: screen frost flash
        this.effects.frostFlash = 0.6;
        break;
      }

      case 'hurricane': {
        // 飓风：绿色色块从终点推向起点，对沿途敌人造成击退效果
        const top = sorted().slice(0, this.hurricaneTargets);
        const kbDist = 0.5 * this.hurricaneKbMult;

        if (top.length === 0) break;

        // Find the farthest and nearest progress of affected enemies
        const maxP = top[0].pathProgress;
        const minP = top[top.length - 1].pathProgress - kbDist;

        for (const e of top) {
          const newProgress = Math.max(0, e.pathProgress - kbDist);
          ctx.onEnemyPositionSet(e, newProgress);
          const pos = ctx.getPathPos(newProgress);
          e.x = pos.x;
          e.y = pos.y;

          // cyclone: damage enemies on path during sweep
          if (this.cyclone) {
            ctx.onEnemyDamage(e, BASE_DAMAGE * 5);
          }
        }

        // Visual: hurricane sweep effect from maxP down to minP
        this.effects.hurricaneEffects.push({
          startProgress: Math.max(0, minP),
          endProgress: maxP,
          currentProgress: maxP,
          speed: 1.2,   // progress units per second (fast sweep)
          active: true,
        });
        break;
      }
    }
  }

  private _makeLightningBolt(x1: number, y1: number, x2: number, y2: number): LightningBolt {
    const branches: LightningBolt['branches'] = [];
    // Create zigzag branches along the bolt
    const steps = 6;
    const dx = (x2 - x1) / steps;
    const dy = (y2 - y1) / steps;
    let px = x1, py = y1;

    for (let i = 0; i < steps - 1; i++) {
      const nx = px + dx + (Math.random() - 0.5) * 30;
      const ny = py + dy + (Math.random() - 0.5) * 30;
      branches.push({ x1: px, y1: py, x2: nx, y2: ny, alpha: 1 });
      // Occasional fork
      if (Math.random() < 0.4) {
        const forkX = nx + (Math.random() - 0.5) * 40;
        const forkY = ny + Math.random() * 30;
        branches.push({ x1: nx, y1: ny, x2: forkX, y2: forkY, alpha: 0.6 });
      }
      px = nx;
      py = ny;
    }
    branches.push({ x1: px, y1: py, x2: x2, y2: y2, alpha: 1 });

    return {
      fromX: x1, fromY: y1,
      toX: x2, toY: y2,
      alpha: 1,
      branches,
      flashTimer: 0,
    };
  }

  reset(): void {
    for (const skill of this._skills.values()) {
      skill.energy = 0;
    }
    this.effects = {
      fireZones: [],
      lightningBolts: [],
      hurricaneParticles: [],
      hurricaneEffects: [],
      frostFlash: 0,
    };
  }
}

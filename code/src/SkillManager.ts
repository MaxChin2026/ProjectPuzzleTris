// ============================================================
// ELEMENTRIS — SkillManager
// Manages 4 element energy pools: fire / lightning / frost / hurricane.
// Energy accumulates by clearing cells of the matching element color.
// Every SKILL_ENERGY_PER_CHARGE cells cleared = 1 charge; charges stack without cap.
// Clicking a skill icon releases 1 charge and applies the effect.
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
  energy: number;   // raw accumulated cell count
}

const SKILL_DEFS: Record<ElementType, Pick<ElementSkill, 'name' | 'icon'>> = {
  fire:      { name: '火焰', icon: '🔥' },
  lightning: { name: '闪电', icon: '⚡' },
  frost:     { name: '冰霜', icon: '❄️' },
  hurricane: { name: '飓风', icon: '🌪️' },
};

export class SkillManager {
  private _skills: Map<ElementType, ElementSkill>;

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

  /** Number of fully-accumulated charges available */
  getCharges(el: ElementType): number {
    return Math.floor(this._skills.get(el)!.energy / SKILL_ENERGY_PER_CHARGE);
  }

  /** Fractional progress toward the next charge (0~1) */
  getPartialProgress(el: ElementType): number {
    const energy = this._skills.get(el)!.energy;
    return (energy % SKILL_ENERGY_PER_CHARGE) / SKILL_ENERGY_PER_CHARGE;
  }

  /** Consume 1 charge and execute the skill. Returns false if no charge available. */
  useSkill(el: ElementType, ctx: SkillContext): boolean {
    if (this.getCharges(el) < 1) return false;
    this._skills.get(el)!.energy -= SKILL_ENERGY_PER_CHARGE;
    this._execute(el, ctx);
    return true;
  }

  private _execute(el: ElementType, ctx: SkillContext): void {
    const sorted = () => [...ctx.enemies].sort((a, b) => b.pathProgress - a.pathProgress);

    switch (el) {
      case 'fire': {
        // 火焰：对所有敌人施加强力火焰DoT（30伤害/秒，持续5秒 = 150总伤害）
        for (const e of ctx.enemies) {
          const existing = e.statusEffects.findIndex(fx => fx.type === StatusEffectType.FIRE);
          const newFx = { type: StatusEffectType.FIRE, remaining: 5, value: BASE_DAMAGE * 3 };
          if (existing >= 0) e.statusEffects[existing] = newFx;
          else e.statusEffects.push(newFx);
        }
        break;
      }
      case 'lightning': {
        // 闪电：链击最多5个最靠近终点的敌人（80/60/40/20/10 伤害）
        const targets = sorted().slice(0, 5);
        const mults = [8, 6, 4, 2, 1];
        for (let i = 0; i < targets.length; i++) {
          ctx.onEnemyDamage(targets[i], BASE_DAMAGE * mults[i]);
        }
        break;
      }
      case 'frost': {
        // 冰霜：冻结所有敌人（免疫冻结的改为减速）
        for (const e of ctx.enemies) {
          if (!e.immuneToFreeze) {
            const existing = e.statusEffects.findIndex(fx => fx.type === StatusEffectType.FREEZE);
            const newFx = { type: StatusEffectType.FREEZE, remaining: 4 };
            if (existing >= 0) e.statusEffects[existing] = newFx;
            else e.statusEffects.push(newFx);
          } else {
            const existing = e.statusEffects.findIndex(fx => fx.type === StatusEffectType.SLOW);
            const newFx = { type: StatusEffectType.SLOW, remaining: 6, value: 0.7 };
            if (existing >= 0) e.statusEffects[existing] = newFx;
            else e.statusEffects.push(newFx);
          }
        }
        break;
      }
      case 'hurricane': {
        // 飓风：击退最靠近终点的3个敌人50%路径，并立即更新视觉位置
        const top = sorted().slice(0, 3);
        for (const e of top) {
          const newProgress = Math.max(0, e.pathProgress - 0.5);
          ctx.onEnemyPositionSet(e, newProgress);
          // Immediately update visual position so the knockback is instant
          const pos = ctx.getPathPos(newProgress);
          e.x = pos.x;
          e.y = pos.y;
        }
        break;
      }
    }
  }

  reset(): void {
    for (const skill of this._skills.values()) {
      skill.energy = 0;
    }
  }
}

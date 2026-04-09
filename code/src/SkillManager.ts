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
        // 火焰：对所有敌人施加火焰DoT（区域持续伤害）
        for (const e of ctx.enemies) {
          e.statusEffects.push({ type: StatusEffectType.FIRE, remaining: 8, value: BASE_DAMAGE * 0.5 });
        }
        break;
      }
      case 'lightning': {
        // 闪电：链击最多5个最靠近终点的敌人
        const targets = sorted().slice(0, 5);
        let mult = 1.2;
        for (const e of targets) {
          ctx.onEnemyDamage(e, BASE_DAMAGE * mult);
          mult = Math.max(0.4, mult - 0.2);
        }
        break;
      }
      case 'frost': {
        // 冰霜：冻结所有敌人（免疫冻结的改为减速）
        for (const e of ctx.enemies) {
          if (!e.immuneToFreeze) {
            e.statusEffects.push({ type: StatusEffectType.FREEZE, remaining: 3 });
          } else {
            e.statusEffects.push({ type: StatusEffectType.SLOW, remaining: 5, value: 0.6 });
          }
        }
        break;
      }
      case 'hurricane': {
        // 飓风：击退最靠近终点的3个敌人（减少路径进度）
        const top = sorted().slice(0, 3);
        for (const e of top) {
          ctx.onEnemyPositionSet(e, Math.max(0, e.pathProgress - 0.25));
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

// ============================================================
// ELEMENTRIS - Renderer
// Canvas 2D rendering for all game layers
// ============================================================

import { GameController } from './GameController';
import { GameState, CellType } from './types';
import {
  COLS, ROWS, CELL_SIZE, PATH_WIDTH,
  BOARD_LEFT, BOARD_TOP, CANVAS_W, CANVAS_H,
  COLOR_EMPTY, COLOR_GHOST, COLOR_GRID_LINE,
  COLOR_HUD_BG, COLOR_PATH_BG, COLOR_ENEMY_HP, COLOR_ENEMY_HP_BG,
  ELEMENT_TYPES, SKILL_PANEL_W, SKILL_ENERGY_PER_CHARGE,
} from './constants';
import {
  CTRL_Y, CTRL_H,
  DPAD_CX, DPAD_CY, DPAD_BTN_OFFSET, DPAD_BTN_SIZE, getDpadBtnRect,
  ROTATE_BTN_CX, ROTATE_BTN_CY, ROTATE_BTN_R,
  getLevelUpCardRect, SKILL_PANEL_X,
  LEVELUP_CARD_W, LEVELUP_CARD_H,
} from './layout';
import { FireZone, LightningBolt, HurricaneEffect } from './SkillManager';

export class Renderer {
  private _ctx: CanvasRenderingContext2D;
  private _gc: GameController;

  constructor(canvas: HTMLCanvasElement, gc: GameController) {
    this._gc = gc;
    canvas.width  = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this._ctx = ctx;
  }

  render(): void {
    const ctx = this._ctx;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    this._drawHUD();
    this._drawPathBackground();
    this._drawBoard();
    this._drawGhostPiece();
    this._drawFireZones();
    this._drawHurricaneEffects();
    this._drawActiveBlock();
    this._drawEnemies();
    this._drawBullets();
    this._drawLightningBolts();
    this._drawFrostFlash();
    this._drawFloatingTexts();
    this._drawSkillPanel();
    this._drawWaveNotification();
    this._drawControlArea();

    if (this._gc.state === GameState.LEVEL_UP) {
      this._drawLevelUpOverlay();
    }

    if (this._gc.state === GameState.GAME_OVER || this._gc.state === GameState.IDLE) {
      this._drawOverlay();
    }
  }

  // ---- HUD ---------------------------------------------------
  private _drawHUD(): void {
    const ctx = this._ctx;
    ctx.fillStyle = COLOR_HUD_BG;
    ctx.fillRect(0, 0, CANVAS_W, BOARD_TOP);

    // HP bar (left)
    const barX = 8, barY = 8, barW = 80, barH = 10;
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barW, barH);
    const hpRatio = this._gc.playerHp / this._gc.maxHp;
    ctx.fillStyle = hpRatio > 0.5 ? '#2ecc71' : hpRatio > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.fillRect(barX, barY, barW * hpRatio, barH);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    ctx.fillStyle = '#eee';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`HP ${this._gc.playerHp}/${this._gc.maxHp}`, barX, barY + barH + 10);

    // Hero level & XP bar
    const xpBarX = barX;
    const xpBarY = barY + barH + 15;
    const xpBarW = barW;
    const xpBarH = 5;
    const xpRatio = this._gc.heroXp / this._gc.heroXpNeeded;
    ctx.fillStyle = '#222';
    ctx.fillRect(xpBarX, xpBarY, xpBarW, xpBarH);
    ctx.fillStyle = '#c8a800';
    ctx.fillRect(xpBarX, xpBarY, xpBarW * xpRatio, xpBarH);
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 9px monospace';
    ctx.fillText(`Lv.${this._gc.heroLevel}  XP ${this._gc.heroXp}/${this._gc.heroXpNeeded}`, xpBarX, xpBarY + xpBarH + 9);

    // Score (center)
    ctx.fillStyle = '#adf';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${this._gc.score}pts`, CANVAS_W / 2, 20);

    // Wave / enemy count (right)
    ctx.fillStyle = '#fa0';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`Wave ${this._gc.wave}  E:${this._gc.enemies.enemies.length}`, CANVAS_W - 6, 20);
    ctx.textAlign = 'left';
  }

  // ---- Path Background ---------------------------------------
  private _drawPathBackground(): void {
    const ctx = this._ctx;
    const boardH = ROWS * CELL_SIZE;
    const boardW = COLS * CELL_SIZE;

    ctx.fillStyle = COLOR_PATH_BG;
    ctx.fillRect(0, BOARD_TOP, BOARD_LEFT, boardH);
    ctx.fillRect(BOARD_LEFT + boardW, BOARD_TOP, PATH_WIDTH, boardH);
    ctx.fillRect(BOARD_LEFT, BOARD_TOP - PATH_WIDTH, boardW, PATH_WIDTH);

    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.font = '12px monospace';
    ctx.save();
    ctx.translate(BOARD_LEFT / 2, BOARD_TOP + boardH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('▲▲▲▲▲', -50, 0);
    ctx.restore();

    ctx.fillText('► ► ► ► ►', BOARD_LEFT + 10, BOARD_TOP - PATH_WIDTH / 2 + 6);

    ctx.save();
    ctx.translate(BOARD_LEFT + boardW + PATH_WIDTH / 2, BOARD_TOP + boardH / 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillText('▲▲▲▲▲', -50, 0);
    ctx.restore();

    ctx.fillStyle = 'rgba(0,255,120,0.5)';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('START', BOARD_LEFT / 2, BOARD_TOP + boardH + 14);
    ctx.fillStyle = 'rgba(255,60,60,0.5)';
    ctx.fillText('END', BOARD_LEFT + boardW + PATH_WIDTH / 2, BOARD_TOP + boardH + 14);
    ctx.textAlign = 'left';
  }

  // ---- Board Grid --------------------------------------------
  private _drawBoard(): void {
    const ctx = this._ctx;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this._gc.board.board[r][c];
        const x = BOARD_LEFT + c * CELL_SIZE;
        const y = BOARD_TOP  + r * CELL_SIZE;

        if (cell.type === CellType.EMPTY) {
          ctx.fillStyle = COLOR_EMPTY;
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
        } else if (cell.type === CellType.GHOST) {
          ctx.fillStyle = COLOR_GHOST;
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
        } else {
          ctx.fillStyle = cell.color;
          ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);
          // Highlight element type with a subtle glow
          ctx.save();
          ctx.globalAlpha = 0.3;
          ctx.shadowBlur = 6;
          ctx.shadowColor = cell.color;
          ctx.fillStyle = cell.color;
          ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);
          ctx.restore();
        }

        ctx.strokeStyle = COLOR_GRID_LINE;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);
      }
    }
  }

  // ---- Ghost Piece -------------------------------------------
  private _drawGhostPiece(): void {
    const ctx = this._ctx;
    const active = this._gc.blocks.active;
    if (!active) return;

    const ghostRow = this._gc.blocks.getGhostRow();
    if (ghostRow === active.row) return;

    ctx.fillStyle = COLOR_GHOST;
    for (const [dr, dc] of active.def.cells) {
      const x = BOARD_LEFT + (active.col + dc) * CELL_SIZE;
      const y = BOARD_TOP  + (ghostRow + dr)  * CELL_SIZE;
      ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    }
  }

  // ---- Active Block ------------------------------------------
  private _drawActiveBlock(): void {
    const ctx = this._ctx;
    const active = this._gc.blocks.active;
    if (!active) return;

    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = active.def.color;

    for (const [dr, dc] of active.def.cells) {
      const x = BOARD_LEFT + (active.col + dc) * CELL_SIZE;
      const y = BOARD_TOP  + (active.row + dr)  * CELL_SIZE;
      ctx.fillStyle = active.def.color;
      ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    }
    ctx.restore();
  }

  // ---- Fire Zones (residual burn zones) ----------------------
  private _drawFireZones(): void {
    const ctx = this._ctx;
    for (const fz of this._gc.skills.effects.fireZones) {
      const lifeRatio = fz.remainingTime / fz.maxTime;
      const alpha = Math.min(0.55, lifeRatio * 0.55);

      // Outer glow
      const grad = ctx.createRadialGradient(fz.x, fz.y, 0, fz.x, fz.y, fz.r);
      grad.addColorStop(0,   `rgba(255,100,0,${alpha})`);
      grad.addColorStop(0.5, `rgba(200,30,0,${alpha * 0.7})`);
      grad.addColorStop(1,   `rgba(255,0,0,0)`);
      ctx.beginPath();
      ctx.arc(fz.x, fz.y, fz.r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Flickering inner core
      const flicker = 0.5 + 0.5 * Math.sin(performance.now() / 120);
      ctx.beginPath();
      ctx.arc(fz.x, fz.y, fz.r * 0.3 * flicker, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,200,50,${alpha * 1.5})`;
      ctx.fill();
    }
  }

  // ---- Hurricane Effects (green sweep) -----------------------
  private _drawHurricaneEffects(): void {
    const ctx = this._ctx;
    for (const he of this._gc.skills.effects.hurricaneEffects) {
      if (!he.active) continue;
      // Draw a wide green band at currentProgress position along the path
      // Sample several points around currentProgress
      const sweepWidth = 0.04; // progress range of the sweep band
      const steps = 12;
      for (let s = 0; s < steps; s++) {
        const p = he.currentProgress + (s / steps) * sweepWidth;
        const pos = this._gc.enemies.getPathPos(p);
        const alpha = (1 - s / steps) * 0.7;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 22, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(60,255,120,${alpha})`;
        ctx.fill();
      }
    }
  }

  // ---- Lightning Bolts ---------------------------------------
  private _drawLightningBolts(): void {
    const ctx = this._ctx;
    for (const bolt of this._gc.skills.effects.lightningBolts) {
      const flicker = 0.7 + 0.3 * Math.sin(bolt.flashTimer * 40);
      for (const seg of bolt.branches) {
        // Outer yellow glow
        ctx.save();
        ctx.globalAlpha = bolt.alpha * seg.alpha * flicker;
        ctx.shadowBlur = 18;
        ctx.shadowColor = '#ffff00';
        ctx.strokeStyle = '#ffee00';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        ctx.stroke();

        // White hot core
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#ffffff';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // ---- Frost Flash (full-canvas blue overlay) ----------------
  private _drawFrostFlash(): void {
    const alpha = this._gc.skills.effects.frostFlash;
    if (alpha <= 0) return;
    const ctx = this._ctx;
    ctx.fillStyle = `rgba(100,200,255,${alpha * 0.35})`;
    ctx.fillRect(0, BOARD_TOP, CANVAS_W, ROWS * CELL_SIZE);
    // Frost border ring
    ctx.strokeStyle = `rgba(150,230,255,${alpha})`;
    ctx.lineWidth = 6;
    ctx.strokeRect(BOARD_LEFT, BOARD_TOP, COLS * CELL_SIZE, ROWS * CELL_SIZE);
  }

  // ---- Enemies -----------------------------------------------
  private _drawEnemies(): void {
    const ctx = this._ctx;
    const R = 10;

    for (const e of this._gc.enemies.enemies) {
      const eTypeColors: Record<string, string> = {
        NORMAL: '#e74c3c',
        ELITE: '#9b59b6',
        BOSS: '#f39c12',
      };
      const color = eTypeColors[e.type] ?? '#e74c3c';

      // Check burning
      const isBurning = e.statusEffects.some(fx => fx.type === 'FIRE');
      const isFrozen  = e.statusEffects.some(fx => fx.type === 'FREEZE' || fx.type === 'STUN');

      ctx.save();
      if (isBurning) {
        ctx.shadowBlur = 16;
        ctx.shadowColor = '#ff4400';
      }

      ctx.beginPath();
      ctx.arc(e.x, e.y, R, 0, Math.PI * 2);
      ctx.fillStyle = isFrozen ? '#aaddff' : color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // Burning flame overlay
      if (isBurning) {
        const flicker = 0.6 + 0.4 * Math.sin(performance.now() / 80);
        ctx.fillStyle = `rgba(255,80,0,${flicker * 0.5})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y - 2, R * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Frozen ring
      if (isFrozen) {
        ctx.strokeStyle = '#44cfff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, R + 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      // HP bar
      const bw = 24, bh = 4;
      const bx = e.x - bw / 2, by = e.y - R - 8;
      ctx.fillStyle = COLOR_ENEMY_HP_BG;
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = COLOR_ENEMY_HP;
      ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), bh);
    }
  }

  // ---- Bullets -----------------------------------------------
  private _drawBullets(): void {
    const ctx = this._ctx;
    const bs = this._gc.bullets;

    for (const b of bs.bullets) {
      const pos = bs.getBulletPos(b);

      const critTier = b.critMultiplier <= 1 ? 0
        : b.critMultiplier <= 1.5 ? 1
        : b.critMultiplier <= 2.0 ? 2 : 3;
      const radius = 4 + critTier * 2.5;

      ctx.save();
      ctx.shadowBlur = 20 + critTier * 10;
      ctx.shadowColor = b.color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      const prevProgress = Math.max(0, b.progress - 0.15);
      const prevProg = { ...b, progress: prevProgress };
      const prevPos = bs.getBulletPos(prevProg as typeof b);
      ctx.beginPath();
      ctx.moveTo(prevPos.x, prevPos.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = b.color;
      ctx.lineWidth = radius * 0.8;
      ctx.globalAlpha = 0.4;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // ---- Floating Texts ----------------------------------------
  private _drawFloatingTexts(): void {
    const ctx = this._ctx;
    for (const ft of this._gc.bullets.floatingTexts) {
      ctx.globalAlpha = ft.alpha;
      ctx.font = `bold ${ft.size}px monospace`;
      ctx.fillStyle = ft.color;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  // ---- Skill Panel (right side) + NEXT piece preview ----
  private _drawSkillPanel(): void {
    const ctx = this._ctx;
    const panelX = SKILL_PANEL_X;
    const panelW = SKILL_PANEL_W;
    const boardH = ROWS * CELL_SIZE;
    ctx.fillStyle = 'rgba(10,10,20,0.92)';
    ctx.fillRect(panelX, BOARD_TOP, panelW, boardH);

    // NEXT piece preview (top of panel)
    const nextBoxH = 78;
    const nextBoxY = BOARD_TOP + 4;
    ctx.fillStyle = 'rgba(20,20,35,0.9)';
    ctx.fillRect(panelX + 2, nextBoxY, panelW - 4, nextBoxH);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX + 2, nextBoxY, panelW - 4, nextBoxH);
    ctx.fillStyle = 'rgba(180,180,180,0.6)';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('NEXT', panelX + panelW / 2, nextBoxY + 10);
    const next = this._gc.blocks.next;
    if (next) {
      const cellSz = 10;
      const nrows = next.cells.map(([r]) => r);
      const ncols = next.cells.map(([, c]) => c);
      const nMinR = Math.min(...nrows), nMinC = Math.min(...ncols);
      const nMaxC = Math.max(...ncols);
      const nMaxR = Math.max(...nrows);
      const nbw = (nMaxC - nMinC + 1) * cellSz;
      const nbh = (nMaxR - nMinR + 1) * cellSz;
      const offX = panelX + (panelW - nbw) / 2;
      const offY = nextBoxY + 14 + (nextBoxH - 14 - nbh) / 2;
      ctx.save();
      ctx.shadowBlur = 8;
      ctx.shadowColor = next.color;
      for (const [dr, dc] of next.cells) {
        const cx2 = offX + (dc - nMinC) * cellSz;
        const cy2 = offY + (dr - nMinR) * cellSz;
        ctx.fillStyle = next.color;
        ctx.fillRect(cx2 + 1, cy2 + 1, cellSz - 2, cellSz - 2);
      }
      ctx.restore();
    }

    // Skill icons (below NEXT)
    const skillsAreaY = nextBoxY + nextBoxH + 6;
    const skillsAreaH = boardH - nextBoxH - 10;
    const skills = this._gc.skills.all;
    const iconR = 17;
    const slotH = Math.floor(skillsAreaH / skills.length);
    const panCX = panelX + panelW / 2;
    for (let i = 0; i < skills.length; i++) {
      const sk = skills[i];
      const cy = skillsAreaY + slotH * i + slotH / 2;
      const charges = this._gc.skills.getCharges(sk.element);
      const partial = this._gc.skills.getPartialProgress(sk.element);
      const dim = charges === 0 && partial < 0.05;
      ctx.beginPath();
      ctx.arc(panCX, cy, iconR, 0, Math.PI * 2);
      ctx.fillStyle = dim ? 'rgba(20,20,35,0.7)' : 'rgba(20,20,35,0.95)';
      ctx.fill();
      this._drawElementIcon(ctx, sk.element, panCX, cy, iconR, dim);
      const startAngle = -Math.PI / 2;
      if (charges > 0) {
        const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 300 + i);
        ctx.save();
        ctx.shadowBlur = 14 * pulse; ctx.shadowColor = sk.color;
        ctx.beginPath(); ctx.arc(panCX, cy, iconR + 2, 0, Math.PI * 2);
        ctx.strokeStyle = sk.color; ctx.lineWidth = 2.5; ctx.globalAlpha = pulse;
        ctx.stroke(); ctx.restore(); ctx.globalAlpha = 1;
      }
      if (partial > 0.01) {
        ctx.beginPath();
        ctx.arc(panCX, cy, iconR + 2, startAngle, startAngle + partial * Math.PI * 2);
        ctx.strokeStyle = sk.color; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.5;
        ctx.stroke(); ctx.globalAlpha = 1;
      }
      if (charges > 0) {
        const bx = panCX + iconR * 0.65, by = cy - iconR * 0.65;
        ctx.beginPath(); ctx.arc(bx, by, 7, 0, Math.PI * 2);
        ctx.fillStyle = sk.color; ctx.fill();
        ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center';
        ctx.textBaseline = 'middle'; ctx.fillStyle = '#000';
        ctx.fillText(String(charges), bx, by);
      }
      ctx.textBaseline = 'alphabetic';
    }
    ctx.textAlign = 'left';
  }

  private _drawElementIcon(ctx: CanvasRenderingContext2D, el: string, x: number, y: number, r: number, dim: boolean): void {
    const a = dim ? 0.3 : 1;
    switch (el) {
      case 'fire': {
        const grad = ctx.createRadialGradient(x, y + r * 0.3, 0, x, y, r);
        grad.addColorStop(0, 'rgba(255,220,0,' + a + ')');
        grad.addColorStop(0.5, 'rgba(255,80,0,' + a + ')');
        grad.addColorStop(1, 'rgba(180,0,0,' + (a * 0.3) + ')');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.ellipse(x, y + r * 0.2, r * 0.55, r * 0.75, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,100,' + (a * 0.9) + ')';
        ctx.beginPath(); ctx.ellipse(x, y - r * 0.3, r * 0.25, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'lightning': {
        ctx.save();
        if (!dim) { ctx.shadowBlur = 10; ctx.shadowColor = '#ffff00'; }
        ctx.fillStyle = 'rgba(255,220,0,' + a + ')'; ctx.strokeStyle = 'rgba(255,255,200,' + a + ')'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + r * 0.15, y - r * 0.85); ctx.lineTo(x - r * 0.15, y - r * 0.1);
        ctx.lineTo(x + r * 0.25, y - r * 0.1);  ctx.lineTo(x - r * 0.15, y + r * 0.85);
        ctx.lineTo(x + r * 0.1,  y + r * 0.1);  ctx.lineTo(x - r * 0.25, y + r * 0.1);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore(); break;
      }
      case 'frost': {
        ctx.save();
        if (!dim) { ctx.shadowBlur = 8; ctx.shadowColor = '#88eeff'; }
        ctx.strokeStyle = 'rgba(100,200,255,' + a + ')'; ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          ctx.beginPath(); ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(angle) * r * 0.85, y + Math.sin(angle) * r * 0.85); ctx.stroke();
          const mx = x + Math.cos(angle) * r * 0.5, my = y + Math.sin(angle) * r * 0.5;
          const tickA = angle + Math.PI / 4;
          ctx.beginPath();
          ctx.moveTo(mx + Math.cos(tickA) * r * 0.25, my + Math.sin(tickA) * r * 0.25);
          ctx.lineTo(mx - Math.cos(tickA) * r * 0.25, my - Math.sin(tickA) * r * 0.25); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(150,230,255,' + (a * 0.9) + ')';
        ctx.beginPath(); ctx.arc(x, y, r * 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.restore(); break;
      }
      case 'hurricane': {
        ctx.save();
        if (!dim) { ctx.shadowBlur = 10; ctx.shadowColor = '#44ff88'; }
        ctx.strokeStyle = 'rgba(40,220,100,' + a + ')'; ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i < 30; i++) {
          const ang = (i / 30) * Math.PI * 2.5;
          const rad = r * 0.2 + r * 0.6 * (i / 30);
          if (i === 0) ctx.moveTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad);
          else ctx.lineTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad);
        }
        ctx.stroke();
        ctx.fillStyle = 'rgba(60,255,130,' + a + ')';
        ctx.beginPath(); ctx.arc(x, y, r * 0.18, 0, Math.PI * 2); ctx.fill();
        ctx.restore(); break;
      }
    }
  }

  // ---- Control Area (D-pad + rotate + next piece) ------------
  private _drawControlArea(): void {
    const ctx = this._ctx;

    // Background
    ctx.fillStyle = 'rgba(15,15,25,0.95)';
    ctx.fillRect(0, CTRL_Y, CANVAS_W, CTRL_H);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, CTRL_Y);
    ctx.lineTo(CANVAS_W, CTRL_Y);
    ctx.stroke();

    this._drawDpad();
    this._drawRotateButton();
  }

  private _drawDpad(): void {
    const ctx = this._ctx;
    const dirs = ['left', 'right', 'up', 'down'] as const;
    const labels: Record<string, string> = { left: '\u25c4', right: '\u25ba', up: '\u25b2', down: '\u25bc' };

    for (const dir of dirs) {
      const r = getDpadBtnRect(dir);
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;

      // Button background
      ctx.fillStyle = 'rgba(60,60,90,0.85)';
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Arrow label
      ctx.fillStyle = '#ddd';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labels[dir], cx, cy);
    }
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
  }

  private _drawRotateButton(): void {
    const ctx = this._ctx;
    const cx = ROTATE_BTN_CX;
    const cy = ROTATE_BTN_CY;
    const r  = ROTATE_BTN_R;

    ctx.fillStyle = 'rgba(80,50,120,0.9)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,150,255,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#c080ff';
    ctx.fillStyle = '#ddd';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('↻', cx, cy);
    ctx.restore();

    ctx.fillStyle = 'rgba(200,200,200,0.5)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('旋转', cx, cy + r + 12);
    ctx.textAlign = 'left';
  }

  // ---- Wave Notification (center top of board) --------------
  private _drawWaveNotification(): void {
    const notif = this._gc.waveNotification;
    if (!notif || notif.alpha <= 0) return;
    const ctx = this._ctx;
    const boardCX = BOARD_LEFT + (COLS * CELL_SIZE) / 2;
    const boardCY = BOARD_TOP + (ROWS * CELL_SIZE) / 4;
    // Scale: animate in (from alpha=0) and out (fade)
    const scale = 0.8 + 0.2 * Math.min(1, (2.2 - notif.timer) / 0.3);
    ctx.save();
    ctx.globalAlpha = notif.alpha;
    ctx.translate(boardCX, boardCY);
    ctx.scale(scale, scale);
    // Shadow/glow
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#ff8800';
    // Background pill
    const text = notif.text;
    ctx.font = 'bold 28px monospace';
    const tw = ctx.measureText(text).width;
    const ph = 42, pw = tw + 32;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.beginPath();
    ctx.roundRect(-pw / 2, -ph / 2, pw, ph, 12);
    ctx.fill();
    ctx.strokeStyle = '#ff8800';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Text
    ctx.fillStyle = '#ffcc00';
    ctx.shadowBlur = 0;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 0);
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
  }

  // ---- Level-Up Overlay --------------------------------------
  private _drawLevelUpOverlay(): void {
    const ctx = this._ctx;
    const gc  = this._gc;

    // Dim background
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Title
    const titleY = BOARD_TOP + 30;
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 16;
    ctx.shadowColor = '#ffd700';
    ctx.fillText(`LEVEL UP! Lv.${gc.heroLevel}`, CANVAS_W / 2, titleY);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#aaa';
    ctx.font = '11px monospace';
    ctx.fillText('选择一个被动技能', CANVAS_W / 2, titleY + 18);

    // Skill cards
    for (let i = 0; i < gc.levelUpOptions.length; i++) {
      const sk = gc.levelUpOptions[i];
      const r  = getLevelUpCardRect(i);

      // Card background
      const elementColors: Record<string, string> = {
        fire: '#ff4444', lightning: '#ffcc00', frost: '#44b8ff',
        hurricane: '#44ff88', neutral: '#8888bb',
      };
      const elColor = elementColors[sk.element] ?? '#888';

      ctx.fillStyle = 'rgba(20,20,35,0.95)';
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 10);
      ctx.fill();

      ctx.strokeStyle = elColor;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 10;
      ctx.shadowColor = elColor;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 10);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Icon
      ctx.font = '26px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sk.icon, r.x + r.w / 2, r.y + 28);

      // Name
      ctx.fillStyle = elColor;
      ctx.font = 'bold 11px monospace';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(sk.name, r.x + r.w / 2, r.y + 52);

      // Desc (wrap)
      ctx.fillStyle = '#ccc';
      ctx.font = '9px monospace';
      const words = sk.desc;
      const maxW = r.w - 8;
      this._wrapText(words, r.x + r.w / 2, r.y + 68, maxW, 12);

      // Tap hint
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '9px monospace';
      ctx.fillText(`[${i + 1}]`, r.x + r.w / 2, r.y + r.h - 8);
    }

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
  }

  private _wrapText(text: string, cx: number, y: number, maxW: number, lineH: number): void {
    const ctx = this._ctx;
    // Simple char-based wrap for Chinese/mixed text
    const chars = [...text];
    let line = '';
    for (const ch of chars) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxW && line.length > 0) {
        ctx.fillText(line, cx, y);
        y += lineH;
        line = ch;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, cx, y);
  }

  // ---- Overlay (Start / Game Over) ---------------------------
  private _drawOverlay(): void {
    const ctx = this._ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const cx = CANVAS_W / 2;
    const cy = CANVAS_H / 2;

    if (this._gc.state === GameState.IDLE) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ELEMENTRIS', cx, cy - 30);
      ctx.font = '14px monospace';
      ctx.fillStyle = '#adf';
      ctx.fillText('Tetris x Tower Defense', cx, cy);
      ctx.fillStyle = '#fa0';
      ctx.fillText('点击开始', cx, cy + 40);
    } else if (this._gc.state === GameState.GAME_OVER) {
      ctx.fillStyle = '#ff4b4b';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', cx, cy - 30);
      ctx.fillStyle = '#fff';
      ctx.font = '14px monospace';
      ctx.fillText(`Score: ${this._gc.score}`, cx, cy + 5);
      ctx.fillStyle = '#fa0';
      ctx.fillText('点击重新开始', cx, cy + 40);
    }

    ctx.textAlign = 'left';
  }
}

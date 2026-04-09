// ============================================================
// ELEMENTRIS — Renderer
// Canvas 2D rendering for all game layers
// ============================================================

import { GameController } from './GameController';
import { GameState, CellType } from './types';
import {
  COLS, ROWS, CELL_SIZE, PATH_WIDTH,
  BOARD_LEFT, BOARD_TOP, CANVAS_W, CANVAS_H,
  COLOR_EMPTY, COLOR_GHOST, COLOR_GRID_LINE,
  COLOR_HUD_BG, COLOR_PATH_BG, COLOR_ENEMY_HP, COLOR_ENEMY_HP_BG,
  SLOT_COUNT, ELEMENT_TYPES, SKILL_PANEL_W, SKILL_ENERGY_PER_CHARGE,
} from './constants';
import { BulletSystem as _BulletSystem } from './BulletSystem';
import { getPathPosition as _getPathPosition } from './EnemyManager';
import { getSlotRect, CANCEL_ZONE_X, CANCEL_ZONE_Y, CANCEL_ZONE_W, CANCEL_ZONE_H } from './layout';

const _HUD_H = BOARD_TOP; // kept for reference

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

    // Background
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    this._drawHUD();
    this._drawPathBackground();
    this._drawBoard();
    this._drawGhostPiece();
    this._drawActiveBlock();
    this._drawEnemies();
    this._drawBullets();
    this._drawFloatingTexts();
    this._drawSlots();
    this._drawSkillPanel();

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
    const barX = 8, barY = 8, barW = 90, barH = 10;
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barW, barH);
    const hpRatio = this._gc.playerHp / this._gc.maxHp;
    ctx.fillStyle = hpRatio > 0.5 ? '#2ecc71' : hpRatio > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.fillRect(barX, barY, barW * hpRatio, barH);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    ctx.fillStyle = '#eee';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(`HP ${this._gc.playerHp}`, barX + 2, barY + barH + 12);

    // Score (center)
    ctx.fillStyle = '#adf';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${this._gc.score}pts`, CANVAS_W / 2, 22);

    // Enemy count (right)
    ctx.fillStyle = '#fa0';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`👾 ${this._gc.enemies.enemies.length}`, CANVAS_W - 6, 22);
    ctx.textAlign = 'left';
  }

  // ---- Path Background ---------------------------------------
  private _drawPathBackground(): void {
    const ctx = this._ctx;
    const boardH = ROWS * CELL_SIZE;
    const boardW = COLS * CELL_SIZE;

    ctx.fillStyle = COLOR_PATH_BG;
    // Left path
    ctx.fillRect(0, BOARD_TOP, BOARD_LEFT, boardH);
    // Right path
    ctx.fillRect(BOARD_LEFT + boardW, BOARD_TOP, PATH_WIDTH, boardH);
    // Top path
    ctx.fillRect(BOARD_LEFT, BOARD_TOP - PATH_WIDTH, boardW, PATH_WIDTH);

    // Path direction arrows (subtle)
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

    // START / END labels
    ctx.fillStyle = 'rgba(0,255,120,0.5)';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('START', BOARD_LEFT / 2, BOARD_TOP + boardH + 14);
    ctx.fillStyle = 'rgba(255,60,60,0.5)';
    ctx.fillText('END', BOARD_LEFT + boardW + PATH_WIDTH / 2, BOARD_TOP + boardH + 14);

    // Cancel zone indicator (shown when a block is active)
    if (this._gc.blocks.active) {
      ctx.fillStyle = 'rgba(255,0,0,0.18)';
      ctx.fillRect(CANCEL_ZONE_X, CANCEL_ZONE_Y, CANCEL_ZONE_W, CANCEL_ZONE_H);
      ctx.fillStyle = 'rgba(255,60,60,0.85)';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('✕', CANCEL_ZONE_X + CANCEL_ZONE_W / 2, CANCEL_ZONE_Y + CANCEL_ZONE_H / 2 + 4);
    }
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
        }

        // Grid line
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

    for (let i = 0; i < active.def.cells.length; i++) {
      const [dr, dc] = active.def.cells[i];
      const x = BOARD_LEFT + (active.col + dc) * CELL_SIZE;
      const y = BOARD_TOP  + (active.row + dr)  * CELL_SIZE;

      ctx.fillStyle = active.def.color;
      ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    }
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

      // Body
      ctx.beginPath();
      ctx.arc(e.x, e.y, R, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Status effect indicators
      if (e.statusEffects.some(fx => fx.type === 'FREEZE' || fx.type === 'STUN')) {
        ctx.strokeStyle = '#00cfff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, R + 3, 0, Math.PI * 2);
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
    const now = performance.now();

    for (const b of bs.bullets) {
      const pos = bs.getBulletPos(b);

      // Determine bullet radius by crit tier
      const critTier = b.critMultiplier <= 1 ? 0
        : b.critMultiplier <= 1.5 ? 1
        : b.critMultiplier <= 2.0 ? 2 : 3;
      const radius = 4 + critTier * 2.5;

      // Outer glow
      ctx.save();
      ctx.shadowBlur = 20 + critTier * 10;
      ctx.shadowColor = b.color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
      ctx.restore();

      // White hot core
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Trail: draw a short arc backwards along bezier
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

  // ---- Block Slots -------------------------------------------
  private _drawSlots(): void {
    const ctx = this._ctx;
    const numSlots = SLOT_COUNT;

    for (let i = 0; i < numSlots; i++) {
      const rect = getSlotRect(i);
      const slot = this._gc.blocks.slots[i];

      // Slot background
      const isActive = this._gc.blocks.active?.slotIndex === i;
      ctx.fillStyle = isActive ? 'rgba(255,200,50,0.15)' : 'rgba(255,255,255,0.04)';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = isActive ? '#ffd700' : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

      if (!slot) {
        // Empty slot
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('—', rect.x + rect.w / 2, rect.y + rect.h / 2 + 4);
        ctx.textAlign = 'left';
        continue;
      }

      // Draw block inside slot (scale to fit; cellSz=12 fits 5 slots in board width)
      const cellSz = 12;
      const rows = slot.cells.map(([r]) => r);
      const cols_ = slot.cells.map(([, c]) => c);
      const minR = Math.min(...rows), maxR = Math.max(...rows);
      const minC = Math.min(...cols_), maxC = Math.max(...cols_);
      const bw = (maxC - minC + 1) * cellSz;
      const bh = (maxR - minR + 1) * cellSz;
      const offX = rect.x + (rect.w - bw) / 2;
      const offY = rect.y + (rect.h - bh) / 2;

      for (let ci = 0; ci < slot.cells.length; ci++) {
        const [dr, dc] = slot.cells[ci];
        const cx = offX + (dc - minC) * cellSz;
        const cy = offY + (dr - minR) * cellSz;
        ctx.fillStyle = slot.color;
        ctx.fillRect(cx + 1, cy + 1, cellSz - 2, cellSz - 2);
      }
    }
  }

  // ---- Skill Panel (right side) ------------------------------
  private _drawSkillPanel(): void {
    const ctx = this._ctx;
    const panelX = BOARD_LEFT + COLS * CELL_SIZE + PATH_WIDTH;
    const panelW = SKILL_PANEL_W;
    const boardH = ROWS * CELL_SIZE;

    // Panel background
    ctx.fillStyle = 'rgba(10,10,20,0.85)';
    ctx.fillRect(panelX, BOARD_TOP, panelW, boardH);

    const skills = this._gc.skills.all;
    const iconSize = 36;   // circular icon diameter
    const spacing = Math.floor(boardH / skills.length);
    const cx = panelX + panelW / 2;

    for (let i = 0; i < skills.length; i++) {
      const sk = skills[i];
      const cy = BOARD_TOP + spacing * i + spacing / 2;
      const charges = this._gc.skills.getCharges(sk.element);
      const partial = this._gc.skills.getPartialProgress(sk.element);
      const r = iconSize / 2;

      // Background circle
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(30,30,50,0.9)';
      ctx.fill();

      // Outer ring track
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Energy ring — fills per charge (partial charge = fractional arc)
      if (charges > 0 || partial > 0) {
        const fullArcs = charges; // complete rings
        const startAngle = -Math.PI / 2; // top

        // Draw full rings (brighten for multiple charges)
        if (fullArcs > 0) {
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.strokeStyle = sk.color;
          ctx.lineWidth = 3;
          ctx.globalAlpha = Math.min(1, 0.6 + fullArcs * 0.15);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // Draw partial arc (next charge in progress)
        if (partial > 0) {
          ctx.beginPath();
          ctx.arc(cx, cy, r, startAngle, startAngle + partial * Math.PI * 2);
          ctx.strokeStyle = sk.color;
          ctx.lineWidth = 3;
          ctx.globalAlpha = 0.5;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      // Icon emoji
      ctx.font = `${Math.floor(r * 0.9)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = charges > 0 ? '#fff' : 'rgba(200,200,200,0.5)';
      ctx.fillText(sk.icon, cx, cy);

      // Charge count badge (top-right of circle)
      if (charges > 0) {
        const bx = cx + r * 0.6;
        const by = cy - r * 0.6;
        ctx.beginPath();
        ctx.arc(bx, by, 7, 0, Math.PI * 2);
        ctx.fillStyle = sk.color;
        ctx.fill();
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000';
        ctx.fillText(String(charges), bx, by);
      }

      ctx.textBaseline = 'alphabetic';
    }

    ctx.textAlign = 'left';
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
      ctx.fillText('Tetris × Tower Defense', cx, cy);
      ctx.fillStyle = '#fa0';
      ctx.fillText('Tap to Start', cx, cy + 40);
    } else if (this._gc.state === GameState.GAME_OVER) {
      ctx.fillStyle = '#ff4b4b';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', cx, cy - 30);
      ctx.fillStyle = '#fff';
      ctx.font = '14px monospace';
      ctx.fillText(`Score: ${this._gc.score}`, cx, cy + 5);
      ctx.fillStyle = '#fa0';
      ctx.fillText('Tap to Restart', cx, cy + 40);
    }

    ctx.textAlign = 'left';
  }
}

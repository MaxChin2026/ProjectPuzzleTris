const fs = require('fs');
const path = 'c:\\Projects\\ProjectPuzzle\\code\\src\\Renderer.ts';
let content = fs.readFileSync(path, 'utf8');
const start = content.indexOf('  // ---- Skill Panel (right side)');
const end = content.indexOf('  // ---- Control Area');
if (start < 0 || end < 0) { console.error('markers not found', start, end); process.exit(1); }

const newPanel = `  // ---- Skill Panel (right side) + NEXT piece preview ----
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

`;

content = content.substring(0, start) + newPanel + content.substring(end);
fs.writeFileSync(path, content, 'utf8');
console.log('OK - length now:', content.length);

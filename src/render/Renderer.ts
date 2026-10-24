import type { CarState, GameSnapshot } from '../sim/types';
import {
  ARENA_H,
  ARENA_W,
  BOMB_PULSE_MS,
  BOMB_SIZE,
  CAR_SPRITE_H,
  CAR_SPRITE_W,
  COLOR,
  TILE,
} from './theme';

export class Renderer {
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable');
    this.ctx = ctx;
    canvas.width = ARENA_W;
    canvas.height = ARENA_H;
  }

  draw(snap: GameSnapshot): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = COLOR.backdrop;
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);

    if (snap.phase !== 'playing' && snap.phase !== 'ended' && snap.phase !== 'countdown') {
      ctx.restore();
      return;
    }

    const local = snap.cars.find((c) => c.id === snap.localPlayerId);
    const focusX = local?.x ?? ARENA_W / 2;
    const focusY = local?.y ?? ARENA_H / 2;
    let peekX = 0;
    let peekY = 0;
    let best = Infinity;
    for (const b of snap.bombs) {
      const bx = b.col * TILE + TILE / 2;
      const by = b.row * TILE + TILE / 2;
      const d = Math.hypot(bx - focusX, by - focusY);
      if (d < best && d < TILE * 5) {
        best = d;
        peekX = (bx - focusX) * 0.08;
        peekY = (by - focusY) * 0.08;
      }
    }
    peekX = Math.max(-10, Math.min(10, peekX));
    peekY = Math.max(-10, Math.min(10, peekY));
    ctx.translate(-Math.round(peekX), -Math.round(peekY));

    this.drawTiles(snap);
    this.drawCheckpoints(snap);
    this.drawPickups(snap);
    this.drawBombs(snap);
    this.drawCars(snap);
    this.drawExplosions(snap);

    ctx.restore();
  }

  private drawTiles(snap: GameSnapshot): void {
    const ctx = this.ctx;
    for (let r = 0; r < snap.rows; r++) {
      for (let c = 0; c < snap.cols; c++) {
        const kind = snap.tiles[r * snap.cols + c] ?? 'empty';
        const x = c * TILE;
        const y = r * TILE;

        // Asphalt with lane sheen
        const g = ctx.createLinearGradient(x, y, x + TILE, y + TILE);
        g.addColorStop(0, (c + r) % 2 === 0 ? '#323a4f' : COLOR.floor);
        g.addColorStop(1, '#252b3c');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, TILE, TILE);

        if (kind === 'hard') {
          ctx.fillStyle = '#3d4658';
          roundRect(ctx, x + 2, y + 2, TILE - 4, TILE - 4, 5);
          ctx.fill();
          ctx.fillStyle = '#5a657a';
          roundRect(ctx, x + 5, y + 5, TILE - 14, 8, 2);
          ctx.fill();
          ctx.strokeStyle = COLOR.outline;
          ctx.lineWidth = 2;
          roundRect(ctx, x + 2, y + 2, TILE - 4, TILE - 4, 5);
          ctx.stroke();
        } else if (kind === 'soft') {
          // Crate
          ctx.fillStyle = COLOR.softBlock;
          roundRect(ctx, x + 5, y + 5, TILE - 10, TILE - 10, 4);
          ctx.fill();
          
          ctx.strokeStyle = '#b87a30';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.strokeStyle = 'rgba(26,31,46,0.35)';
          ctx.beginPath();
          ctx.moveTo(x + 10, y + TILE / 2);
          ctx.lineTo(x + TILE - 10, y + TILE / 2);
          ctx.moveTo(x + TILE / 2, y + 10);
          ctx.lineTo(x + TILE / 2, y + TILE - 10);
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.15)';
          roundRect(ctx, x + 8, y + 8, 12, 6, 2);
          ctx.fill();
        } else {
          // Subtle road dashes on empty
          if (c % 2 === 1 && r % 2 === 0) {
            ctx.fillStyle = 'rgba(244,241,234,0.06)';
            ctx.fillRect(x + TILE / 2 - 1, y + 10, 2, TILE - 20);
          }
        }
      }
    }
  }

  private drawCheckpoints(snap: GameSnapshot): void {
    if (!snap.checkpoints.length) return;
    const ctx = this.ctx;
    const me = snap.cars.find((c) => c.id === snap.localPlayerId);
    const next = me?.nextCp ?? 0;
    const t = snap.timeMs * 0.006;

    for (const cp of snap.checkpoints) {
      const x = cp.col * TILE + TILE / 2;
      const y = cp.row * TILE + TILE / 2;
      const isFinish = cp.index === 3;
      const cleared = (me?.nextCp ?? 0) > cp.index;
      const isNext = cp.index === next;
      ctx.save();
      ctx.globalAlpha = cleared ? 0.4 : 1;

      if (isFinish) {
        // Checker Finish
        const s = 10;
        for (let i = 0; i < 4; i++) {
          for (let j = 0; j < 4; j++) {
            ctx.fillStyle = (i + j) % 2 === 0 ? '#F4F1EA' : '#1A1F2E';
            ctx.fillRect(x - 20 + i * s, y - 20 + j * s, s, s);
          }
        }
        ctx.strokeStyle = COLOR.accent;
        ctx.lineWidth = 3;
        ctx.strokeRect(x - 21, y - 21, 42, 42);
      } else {
        const pulse = isNext ? 1 + 0.08 * Math.sin(t) : 1;
        ctx.beginPath();
        ctx.arc(x, y, 16 * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = '#2EE6FF';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 10 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(46,230,255,0.2)';
        ctx.fill();
        ctx.fillStyle = '#F4F1EA';
        ctx.font = 'bold 14px system-ui,sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cp.label, x, y + 1);
      }
      ctx.restore();
    }
  }

  private drawPickups(snap: GameSnapshot): void {
    const ctx = this.ctx;
    const bob = Math.sin(snap.timeMs * 0.008) * 2;
    for (const p of snap.pickups) {
      const x = p.col * TILE + TILE / 2;
      const y = p.row * TILE + TILE / 2 + bob;
      const label = p.kind === 'speed' ? '⚡' : p.kind === 'blast' ? '💥' : '💣';
      const fill =
        p.kind === 'speed' ? '#7CFF5A' : p.kind === 'blast' ? '#FFB347' : '#2EE6FF';
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(x, y + 14, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = fill;
      roundRect(ctx, x - 13, y - 13, 26, 26, 8);
      ctx.fill();
      ctx.strokeStyle = COLOR.outline;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = '14px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x, y + 1);
    }
  }

  private drawBombs(snap: GameSnapshot): void {
    const ctx = this.ctx;
    for (const b of snap.bombs) {
      const x = b.col * TILE + TILE / 2;
      const y = b.row * TILE + TILE / 2;
      const age = snap.timeMs - b.plantedAt;
      const left = b.fuseMs - age;
      let scale = 1;
      if (left <= BOMB_PULSE_MS) {
        scale = 1 + 0.18 * Math.sin((BOMB_PULSE_MS - left) * 0.05);
      }
      const s = (BOMB_SIZE / 2) * scale;

      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(x, y + s * 0.7, s * 0.85, s * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();

      const grd = ctx.createRadialGradient(x - 4, y - 4, 2, x, y, s);
      grd.addColorStop(0, '#4a4a4a');
      grd.addColorStop(1, COLOR.bomb);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLOR.outline;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.strokeStyle = COLOR.bombFuse;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + s * 0.35, y - s * 0.55);
      ctx.quadraticCurveTo(x + s * 0.95, y - s * 1.25, x + s * 0.5, y - s * 1.45);
      ctx.stroke();
      ctx.fillStyle = left < 400 ? '#FFF6C8' : COLOR.bombFuse;
      ctx.beginPath();
      ctx.arc(x + s * 0.5, y - s * 1.45, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawCars(snap: GameSnapshot): void {
    for (const car of snap.cars) {
      if (!car.alive) continue;
      this.drawCar(car, snap.timeMs);
    }
  }

  private drawCar(car: CarState, timeMs: number): void {
    const ctx = this.ctx;
    const w = CAR_SPRITE_W;
    const h = CAR_SPRITE_H;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(1, 4, w * 0.42, h * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wheels
    ctx.fillStyle = '#1a1a1a';
    roundRect(ctx, -w / 2 + 4, -h / 2 - 2, 10, 6, 2);
    ctx.fill();
    roundRect(ctx, w / 2 - 14, -h / 2 - 2, 10, 6, 2);
    ctx.fill();
    roundRect(ctx, -w / 2 + 4, h / 2 - 4, 10, 6, 2);
    ctx.fill();
    roundRect(ctx, w / 2 - 14, h / 2 - 4, 10, 6, 2);
    ctx.fill();

    // Body
    const body = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    body.addColorStop(0, shade(car.color, 28));
    body.addColorStop(0.45, car.color);
    body.addColorStop(1, shade(car.color, -35));
    ctx.fillStyle = body;
    roundRect(ctx, -w / 2 + 2, -h / 2 + 3, w - 4, h - 6, 9);
    ctx.fill();
    ctx.strokeStyle = COLOR.outline;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Cabin / windshield
    ctx.fillStyle = 'rgba(180,220,255,0.55)';
    roundRect(ctx, 2, -h / 2 + 8, 12, h - 16, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(26,31,46,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Nose stripe
    ctx.fillStyle = COLOR.ink;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 3, 0);
    ctx.lineTo(w / 2 - 12, -7);
    ctx.lineTo(w / 2 - 12, 7);
    ctx.closePath();
    ctx.fill();

    // Headlights
    ctx.fillStyle = '#FFF6C8';
    ctx.beginPath();
    ctx.arc(w / 2 - 5, -h / 2 + 9, 2.5, 0, Math.PI * 2);
    ctx.arc(w / 2 - 5, h / 2 - 9, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Speed lines when moving
    const sp = Math.hypot(car.vx, car.vy);
    if (sp > 40) {
      ctx.strokeStyle = `rgba(244,241,234,${Math.min(0.45, sp / 400)})`;
      ctx.lineWidth = 2;
      const n = 3 + Math.floor((timeMs / 40) % 2);
      for (let i = 0; i < n; i++) {
        const yy = -8 + i * 8;
        ctx.beginPath();
        ctx.moveTo(-w / 2 - 4 - (sp / 40), yy);
        ctx.lineTo(-w / 2 + 2, yy);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private drawExplosions(snap: GameSnapshot): void {
    const ctx = this.ctx;
    for (const ex of snap.explosions) {
      const t = (snap.timeMs - ex.startedAt) / ex.durationMs;
      for (const cell of ex.cells) {
        const x = cell.col * TILE + TILE / 2;
        const y = cell.row * TILE + TILE / 2;
        const edge = cell.dist >= 2;
        const mid = cell.dist === 1;
        const radius = (TILE * 0.48) * (1 + 0.15 * (1 - t));
        ctx.save();
        ctx.globalAlpha = 1 - t * 0.5;
        const grd = ctx.createRadialGradient(x, y, 2, x, y, radius);
        grd.addColorStop(0, COLOR.blastCore);
        grd.addColorStop(0.45, mid || !edge ? COLOR.blastMid : COLOR.blastEdge);
        grd.addColorStop(1, 'rgba(255,92,58,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        if (!edge) {
          ctx.globalAlpha = 0.9 * (1 - t);
          ctx.fillStyle = COLOR.blastCore;
          ctx.beginPath();
          ctx.arc(x, y, radius * 0.35, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }
  }
}

function shade(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (n & 255) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

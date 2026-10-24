import type { GameSnapshot } from '../sim/types';
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

    // Full 13×11@48 fits the canvas. Camera follow + bomb peek:
    // subtle content offset toward nearest bomb (clamped), for awareness.
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
    this.drawPickups(snap);
    this.drawBombs(snap);
    this.drawCars(snap);
    this.drawExplosions(snap);

    ctx.restore();
  }

  private drawTiles(snap: GameSnapshot): void {
    const ctx = this.ctx;
    if (!snap.tiles.length) {
      for (let r = 0; r < snap.rows; r++) {
        for (let c = 0; c < snap.cols; c++) {
          ctx.fillStyle = COLOR.floor;
          ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
        }
      }
      return;
    }

    for (let r = 0; r < snap.rows; r++) {
      for (let c = 0; c < snap.cols; c++) {
        const kind = snap.tiles[r * snap.cols + c] ?? 'empty';
        const x = c * TILE;
        const y = r * TILE;
        ctx.fillStyle = COLOR.floor;
        ctx.fillRect(x, y, TILE, TILE);

        if ((c + r) % 2 === 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.06)';
          ctx.fillRect(x, y, TILE, TILE);
        }

        if (kind === 'hard') {
          ctx.fillStyle = COLOR.hardWall;
          roundRect(ctx, x + 2, y + 2, TILE - 4, TILE - 4, 6);
          ctx.fill();
          ctx.strokeStyle = COLOR.outline;
          ctx.lineWidth = 2;
          ctx.stroke();
        } else if (kind === 'soft') {
          ctx.fillStyle = COLOR.softBlock;
          roundRect(ctx, x + 4, y + 4, TILE - 8, TILE - 8, 5);
          ctx.fill();
          ctx.strokeStyle = COLOR.outline;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.strokeStyle = 'rgba(26,31,46,0.25)';
          ctx.beginPath();
          ctx.moveTo(x + 10, y + TILE / 2);
          ctx.lineTo(x + TILE - 10, y + TILE / 2);
          ctx.moveTo(x + TILE / 2, y + 10);
          ctx.lineTo(x + TILE / 2, y + TILE - 10);
          ctx.stroke();
        }
      }
    }
  }

  private drawPickups(snap: GameSnapshot): void {
    const ctx = this.ctx;
    for (const p of snap.pickups) {
      const x = p.col * TILE + TILE / 2;
      const y = p.row * TILE + TILE / 2;
      const label = p.kind === 'speed' ? 'S' : p.kind === 'blast' ? 'R' : 'B';
      const fill =
        p.kind === 'speed' ? '#7CFF5A' : p.kind === 'blast' ? '#FFB347' : '#2EE6FF';
      ctx.fillStyle = fill;
      roundRect(ctx, x - 12, y - 12, 24, 24, 6);
      ctx.fill();
      ctx.strokeStyle = COLOR.outline;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = COLOR.outline;
      ctx.font = 'bold 13px system-ui';
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
        scale = 1 + 0.12 * Math.sin((BOMB_PULSE_MS - left) * 0.04);
      }
      const s = (BOMB_SIZE / 2) * scale;
      ctx.fillStyle = COLOR.bomb;
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLOR.outline;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = COLOR.bombFuse;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + s * 0.4, y - s * 0.6);
      ctx.quadraticCurveTo(x + s * 0.9, y - s * 1.2, x + s * 0.55, y - s * 1.35);
      ctx.stroke();
      ctx.fillStyle = COLOR.bombFuse;
      ctx.beginPath();
      ctx.arc(x + s * 0.55, y - s * 1.35, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawCars(snap: GameSnapshot): void {
    const ctx = this.ctx;
    for (const car of snap.cars) {
      if (!car.alive) continue;
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);
      ctx.fillStyle = car.color;
      roundRect(ctx, -CAR_SPRITE_W / 2, -CAR_SPRITE_H / 2, CAR_SPRITE_W, CAR_SPRITE_H, 8);
      ctx.fill();
      ctx.strokeStyle = COLOR.outline;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = COLOR.ink;
      ctx.beginPath();
      ctx.moveTo(CAR_SPRITE_W / 2 - 2, 0);
      ctx.lineTo(CAR_SPRITE_W / 2 - 14, -8);
      ctx.lineTo(CAR_SPRITE_W / 2 - 14, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  private drawExplosions(snap: GameSnapshot): void {
    const ctx = this.ctx;
    for (const ex of snap.explosions) {
      const t = (snap.timeMs - ex.startedAt) / ex.durationMs;
      for (const cell of ex.cells) {
        const x = cell.col * TILE;
        const y = cell.row * TILE;
        const edge = cell.dist >= 2;
        const mid = cell.dist === 1;
        ctx.globalAlpha = 1 - t * 0.35;
        ctx.fillStyle = edge ? COLOR.blastEdge : mid ? COLOR.blastMid : COLOR.blastCore;
        ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
        if (!edge) {
          ctx.fillStyle = COLOR.blastCore;
          ctx.globalAlpha = 0.85 * (1 - t);
          ctx.fillRect(x + 12, y + 12, TILE - 24, TILE - 24);
        }
        ctx.globalAlpha = 1;
      }
    }
  }
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

import type { CarState, GameSnapshot } from '../sim/types';
import {
  ARENA_H,
  ARENA_W,
  BOMB_PULSE_MS,
  COLOR,
  TILE,
} from './theme';

const CAR_SRC = ['/sprites/car_p1.svg', '/sprites/car_p2.svg', '/sprites/car_p3.svg', '/sprites/car_p4.svg'];
const BOMB_SRC = '/sprites/bomb.svg';
const SOFT_SRC = '/sprites/block_soft.svg';
const HARD_SRC = '/sprites/wall_hard.svg';

type ImgMap = Record<string, HTMLImageElement>;

async function loadImg(src: string): Promise<HTMLImageElement> {
  // Vite base path
  const base = import.meta.env.BASE_URL || '/';
  const url = src.startsWith('/') ? base.replace(/\/?$/, '/') + src.slice(1) : src;
  const img = new Image();
  img.src = url;
  await img.decode().catch(() => undefined);
  return img;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private imgs: ImgMap = {};
  private ready = false;
  private shake = 0;
  private particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; color: string; r: number }> = [];

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable');
    this.ctx = ctx;
    // Hi-DPI backbuffer for sharp phones
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(ARENA_W * dpr);
    canvas.height = Math.floor(ARENA_H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    void this.load();
  }

  private async load(): Promise<void> {
    const entries = [
      ...CAR_SRC.map((s, i) => [`car${i}`, s] as const),
      ['bomb', BOMB_SRC] as const,
      ['soft', SOFT_SRC] as const,
      ['hard', HARD_SRC] as const,
    ];
    await Promise.all(
      entries.map(async ([k, s]) => {
        this.imgs[k] = await loadImg(s);
      }),
    );
    this.ready = true;
  }

  bumpShake(amount = 6): void {
    this.shake = Math.max(this.shake, amount);
  }

  draw(snap: GameSnapshot): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = '#0b0e18';
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);

    if (snap.phase !== 'playing' && snap.phase !== 'ended' && snap.phase !== 'countdown') {
      ctx.restore();
      return;
    }

    // Detect new explosions → shake + particles
    for (const ex of snap.explosions) {
      if (snap.timeMs - ex.startedAt < 40) {
        this.bumpShake(8);
        for (const cell of ex.cells) {
          for (let i = 0; i < 4; i++) {
            this.particles.push({
              x: cell.col * TILE + TILE / 2,
              y: cell.row * TILE + TILE / 2,
              vx: (Math.random() - 0.5) * 180,
              vy: (Math.random() - 0.5) * 180,
              life: 0.35 + Math.random() * 0.25,
              color: i % 2 ? COLOR.blastCore : COLOR.blastEdge,
              r: 2 + Math.random() * 3,
            });
          }
        }
      }
    }

    const local = snap.cars.find((c) => c.id === snap.localPlayerId && c.alive)
      ?? snap.cars.find((c) => c.id === snap.localPlayerId)
      ?? snap.cars[0];
    const speed = local ? Math.hypot(local.vx, local.vy) : 0;
    const zoom = 1.55 + Math.min(0.35, speed / 600);

    const cx = local?.x ?? ARENA_W / 2;
    const cy = local?.y ?? ARENA_H / 2;
    const lookX = cx + (local?.vx ?? 0) * 0.12;
    const lookY = cy + (local?.vy ?? 0) * 0.12;

    this.shake *= 0.85;
    const sx = (Math.random() - 0.5) * this.shake;
    const sy = (Math.random() - 0.5) * this.shake;

    ctx.translate(ARENA_W / 2 + sx, ARENA_H / 2 + sy);
    ctx.scale(zoom, zoom);
    ctx.translate(-lookX, -lookY);

    this.drawTiles(snap);
    this.drawCheckpoints(snap);
    this.drawPickups(snap);
    this.drawBombs(snap);
    this.drawCars(snap);
    this.drawExplosions(snap);
    this.drawParticles(1 / 60);

    // Speed vignette
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (speed > 60) {
      const g = ctx.createRadialGradient(
        ARENA_W / 2, ARENA_H / 2, ARENA_H * 0.2,
        ARENA_W / 2, ARENA_H / 2, ARENA_H * 0.75,
      );
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${Math.min(0.55, speed / 500)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, ARENA_W, ARENA_H);
    }

    ctx.restore();
  }

  private drawTiles(snap: GameSnapshot): void {
    const ctx = this.ctx;
    for (let r = 0; r < snap.rows; r++) {
      for (let c = 0; c < snap.cols; c++) {
        const kind = snap.tiles[r * snap.cols + c] ?? 'empty';
        const x = c * TILE;
        const y = r * TILE;

        // Neon asphalt
        ctx.fillStyle = (c + r) % 2 === 0 ? '#1e2436' : '#181e2d';
        ctx.fillRect(x, y, TILE, TILE);

        // Road edge glow on empty
        if (kind === 'empty') {
          ctx.strokeStyle = 'rgba(46,230,255,0.07)';
          ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        }

        if (kind === 'hard') {
          const img = this.imgs.hard;
          if (this.ready && img?.complete) {
            ctx.drawImage(img, x, y, TILE, TILE);
          } else {
            ctx.fillStyle = '#4A5568';
            roundRect(ctx, x + 2, y + 2, TILE - 4, TILE - 4, 6);
            ctx.fill();
          }
        } else if (kind === 'soft') {
          const img = this.imgs.soft;
          if (this.ready && img?.complete) {
            ctx.drawImage(img, x + 2, y + 2, TILE - 4, TILE - 4);
          } else {
            ctx.fillStyle = COLOR.softBlock;
            roundRect(ctx, x + 5, y + 5, TILE - 10, TILE - 10, 4);
            ctx.fill();
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
    const t = snap.timeMs * 0.008;

    for (const cp of snap.checkpoints) {
      const x = cp.col * TILE + TILE / 2;
      const y = cp.row * TILE + TILE / 2;
      const isFinish = cp.index === 3;
      const cleared = (me?.nextCp ?? 0) > cp.index;
      const isNext = cp.index === next;
      ctx.save();
      ctx.globalAlpha = cleared ? 0.35 : 1;

      if (isFinish) {
        for (let i = 0; i < 4; i++) {
          for (let j = 0; j < 4; j++) {
            ctx.fillStyle = (i + j) % 2 === 0 ? '#F4F1EA' : '#1A1F2E';
            ctx.fillRect(x - 22 + i * 11, y - 22 + j * 11, 11, 11);
          }
        }
        ctx.shadowColor = COLOR.accent;
        ctx.shadowBlur = isNext ? 16 : 6;
        ctx.strokeStyle = COLOR.accent;
        ctx.lineWidth = 3;
        ctx.strokeRect(x - 23, y - 23, 46, 46);
      } else {
        const pulse = isNext ? 1 + 0.12 * Math.sin(t) : 1;
        ctx.shadowColor = '#2EE6FF';
        ctx.shadowBlur = isNext ? 18 : 4;
        ctx.beginPath();
        ctx.arc(x, y, 18 * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = '#2EE6FF';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.fillStyle = '#F4F1EA';
        ctx.font = 'bold 16px system-ui,sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 0;
        ctx.fillText(cp.label, x, y + 1);
      }
      ctx.restore();
    }
  }

  private drawPickups(snap: GameSnapshot): void {
    const ctx = this.ctx;
    const bob = Math.sin(snap.timeMs * 0.01) * 3;
    for (const p of snap.pickups) {
      const x = p.col * TILE + TILE / 2;
      const y = p.row * TILE + TILE / 2 + bob;
      const fill =
        p.kind === 'speed' ? '#7CFF5A' : p.kind === 'blast' ? '#FFB347' : '#2EE6FF';
      ctx.save();
      ctx.shadowColor = fill;
      ctx.shadowBlur = 12;
      ctx.fillStyle = fill;
      roundRect(ctx, x - 14, y - 14, 28, 28, 8);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = COLOR.outline;
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.kind === 'speed' ? 'SPD' : p.kind === 'blast' ? 'POW' : 'BOM', x, y + 1);
      ctx.restore();
    }
  }

  private drawBombs(snap: GameSnapshot): void {
    const ctx = this.ctx;
    const img = this.imgs.bomb;
    for (const b of snap.bombs) {
      const x = b.col * TILE + TILE / 2;
      const y = b.row * TILE + TILE / 2;
      const left = b.fuseMs - (snap.timeMs - b.plantedAt);
      let scale = 1;
      if (left <= BOMB_PULSE_MS) scale = 1 + 0.2 * Math.sin((BOMB_PULSE_MS - left) * 0.06);
      const s = 32 * scale;
      ctx.save();
      ctx.shadowColor = COLOR.bombFuse;
      ctx.shadowBlur = left < 500 ? 20 : 6;
      if (this.ready && img?.complete) {
        ctx.drawImage(img, x - s / 2, y - s / 2, s, s);
      } else {
        ctx.fillStyle = COLOR.bomb;
        ctx.beginPath();
        ctx.arc(x, y, s / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      // Danger ring
      ctx.strokeStyle = `rgba(255,92,58,${0.25 + 0.35 * (1 - left / b.fuseMs)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, TILE * b.range * (0.3 + 0.1 * Math.sin(snap.timeMs * 0.02)), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawCars(snap: GameSnapshot): void {
    for (const car of snap.cars) {
      if (!car.alive) continue;
      this.drawCar(car);
    }
  }

  private drawCar(car: CarState): void {
    const ctx = this.ctx;
    const img = this.imgs[`car${car.slot}`];
    const w = 56;
    const h = 46;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(2, 6, w * 0.4, h * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glow
    ctx.shadowColor = car.color;
    ctx.shadowBlur = 14;

    if (this.ready && img?.complete) {
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    } else {
      ctx.fillStyle = car.color;
      roundRect(ctx, -w / 2, -h / 2, w, h, 10);
      ctx.fill();
    }

    // Headlight bloom
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,246,200,0.85)';
    ctx.beginPath();
    ctx.arc(w / 2 - 4, -10, 3, 0, Math.PI * 2);
    ctx.arc(w / 2 - 4, 10, 3, 0, Math.PI * 2);
    ctx.fill();

    const sp = Math.hypot(car.vx, car.vy);
    if (sp > 50) {
      ctx.strokeStyle = `rgba(244,241,234,${Math.min(0.55, sp / 350)})`;
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) {
        const yy = -10 + i * 10;
        ctx.beginPath();
        ctx.moveTo(-w / 2 - 6 - sp / 35, yy);
        ctx.lineTo(-w / 2 + 4, yy);
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
        const radius = TILE * (0.55 + 0.25 * (1 - t));
        ctx.save();
        ctx.globalAlpha = 1 - t * 0.4;
        const grd = ctx.createRadialGradient(x, y, 1, x, y, radius);
        grd.addColorStop(0, COLOR.blastCore);
        grd.addColorStop(0.4, COLOR.blastMid);
        grd.addColorStop(1, 'rgba(255,92,58,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  private drawParticles(dt: number): void {
    const ctx = this.ctx;
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      if (p.life <= 0) return false;
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      return true;
    });
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

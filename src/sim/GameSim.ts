import { CAR_COLLISION_H, CAR_COLLISION_W, COLOR, COLS, ROWS, TILE, BLAST_HOLD_MS } from '../render/theme';
import { createArenaTiles, inBounds, RACE_CHECKPOINTS, SPAWN_TILES, tileIndex } from './map';
import type {
  AppPhase,
  BombState,
  CarState,
  ClientCommand,
  ExplosionState,
  GameSnapshot,
  InputFrame,
  MatchMode,
  PickupKind,
  PickupState,
  TileKind,
  Toast,
} from './types';

const BOMB_FUSE_MS = 2000;
const BOMB_COOLDOWN_MS = 220;
const DEFAULT_RANGE = 2;
const MAX_RANGE = 5;
const MAX_BOMBS_CAP = 3;
const MAX_SPEED_LEVEL = 2;
const BASE_SPEED = 220;
const ACCEL = 2200;
const FRICTION = 8;
const COUNTDOWN_MS = 3000;
const PICKUP_CHANCE = 0.4;

const emptyInput = (): InputFrame => ({
  up: false,
  down: false,
  left: false,
  right: false,
  bomb: false,
});

function roomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += alphabet[(Math.random() * alphabet.length) | 0];
  return s;
}

export class GameSim {
  private phase: AppPhase = 'home';
  private mode: MatchMode = 'survivor';
  private tick = 0;
  private timeMs = 0;
  private countdownEndsAt = 0;
  private roomCodeStr = '';
  private tiles: TileKind[] = [];
  private cars: CarState[] = [];
  private bombs: BombState[] = [];
  private explosions: ExplosionState[] = [];
  private pickups: PickupState[] = [];
  private inputs = new Map<string, InputFrame>();
  private prevBombDown = new Map<string, boolean>();
  private localPlayerId = 'p1';
  private message?: string;
  private soloNote?: string;
  private winnerId?: string;
  private winnerName?: string;
  private toasts: Toast[] = [];
  private nextBombId = 1;
  private nextExplosionId = 1;
  private nextPickupId = 1;
  private nextToastId = 1;

  getSnapshot(): GameSnapshot {
    const aliveCount = this.cars.filter((c) => c.alive).length;
    return {
      phase: this.phase,
      mode: this.mode,
      tick: this.tick,
      timeMs: this.timeMs,
      countdownEndsAt: this.countdownEndsAt,
      roomCode: this.roomCodeStr,
      cols: COLS,
      rows: ROWS,
      tiles: this.tiles.slice(),
      cars: this.cars.map((c) => ({ ...c })),
      bombs: this.bombs.map((b) => ({ ...b })),
      explosions: this.explosions.map((e) => ({
        ...e,
        cells: e.cells.map((cell) => ({ ...cell })),
      })),
      pickups: this.pickups.map((p) => ({ ...p })),
      checkpoints: this.mode === 'race' ? RACE_CHECKPOINTS.map((c) => ({ ...c })) : [],
      localPlayerId: this.localPlayerId,
      aliveCount,
      winnerId: this.winnerId,
      winnerName: this.winnerName,
      toasts: this.toasts.map((t) => ({ ...t })),
      message: this.message,
      soloNote: this.soloNote,
    };
  }

  applyCommand(cmd: ClientCommand): void {
    switch (cmd.type) {
      case 'create_room':
        this.enterRoom(roomCode());
        break;
      case 'join_room': {
        const code = cmd.code.trim().toUpperCase().slice(0, 6);
        if (code.length < 3) {
          this.message = 'Enter a room code (3+ chars)';
          return;
        }
        this.enterRoom(code);
        break;
      }
      case 'set_mode':
        if (this.phase !== 'room') return;
        this.mode = cmd.mode;
        break;
      case 'set_ready':
        if (this.phase !== 'room') return;
        {
          const me = this.cars.find((c) => c.id === this.localPlayerId);
          if (me) me.ready = cmd.ready;
          for (const c of this.cars) {
            if (!c.human) c.ready = cmd.ready;
          }
          this.tryAutoStart();
        }
        break;
      case 'start_match':
        if (this.phase === 'room') this.beginCountdown();
        break;
      case 'rematch':
        if (this.phase === 'ended') this.beginCountdown();
        break;
      case 'leave_to_home':
        this.resetHome();
        break;
      case 'input':
        this.inputs.set(cmd.playerId, { ...cmd.input });
        break;
    }
  }

  step(dtMs: number): void {
    const dt = Math.min(dtMs, 40);
    this.timeMs += dt;
    this.tick += 1;
    this.toasts = this.toasts.filter((t) => t.until > this.timeMs);

    if (this.phase === 'countdown') {
      if (this.timeMs >= this.countdownEndsAt) this.beginPlaying();
      return;
    }

    if (this.phase !== 'playing') return;

    for (const car of this.cars) {
      if (!car.alive) continue;
      if (car.human) {
        const input = this.inputs.get(car.id) ?? emptyInput();
        this.driveCar(car, input, dt / 1000);
        this.tryPlantBomb(car, input);
        this.prevBombDown.set(car.id, input.bomb);
      } else {
        this.stepBot(car, dt / 1000);
      }
      this.tryCollectPickup(car);
      if (this.mode === 'race') this.tryRaceProgress(car);
    }

    this.updateBombs();
    this.updateExplosions();
    this.checkWin();
  }

  private resetHome(): void {
    this.phase = 'home';
    this.mode = 'survivor';
    this.cars = [];
    this.bombs = [];
    this.explosions = [];
    this.pickups = [];
    this.tiles = [];
    this.roomCodeStr = '';
    this.message = undefined;
    this.soloNote = undefined;
    this.winnerId = undefined;
    this.winnerName = undefined;
    this.toasts = [];
  }

  private enterRoom(code: string): void {
    this.phase = 'room';
    this.roomCodeStr = code;
    this.message = undefined;
    this.soloNote =
      'Demo: BOT joins so you can fight / race. Bombs clear soft crates — clear a path or go for the finish.';
    this.winnerId = undefined;
    this.winnerName = undefined;
    this.cars = [
      this.makeCar(0, this.localPlayerId, 'YOU', true),
      this.makeCar(1, 'bot1', 'BOT', false),
    ];
    for (const c of this.cars) {
      this.inputs.set(c.id, emptyInput());
      this.prevBombDown.set(c.id, false);
    }
  }

  private makeCar(slot: number, id: string, name: string, human: boolean): CarState {
    const [sc, sr] = SPAWN_TILES[slot]!;
    return {
      id,
      slot,
      name,
      human,
      x: sc * TILE + TILE / 2,
      y: sr * TILE + TILE / 2,
      vx: 0,
      vy: 0,
      angle: slot === 0 || slot === 2 ? 0 : Math.PI,
      alive: true,
      speedLevel: 0,
      blastRange: DEFAULT_RANGE,
      maxBombs: 1,
      bombsLeft: 1,
      bombCooldownUntil: 0,
      ready: !human,
      color: COLOR.cars[slot] ?? COLOR.cars[0],
      nextCp: 0,
    };
  }

  private tryAutoStart(): void {
    if (this.cars.length < 2) return;
    if (!this.cars.every((c) => c.ready)) return;
    this.beginCountdown();
  }

  private beginCountdown(): void {
    if (this.cars.length < 2) {
      this.message = 'Need ≥2 players (bot joins in loopback)';
      return;
    }
    for (const c of this.cars) c.ready = true;
    this.phase = 'countdown';
    this.countdownEndsAt = this.timeMs + COUNTDOWN_MS;
    this.message = undefined;
    this.winnerId = undefined;
    this.winnerName = undefined;
  }

  private beginPlaying(): void {
    this.phase = 'playing';
    this.tiles = createArenaTiles();
    this.bombs = [];
    this.explosions = [];
    this.pickups = [];
    this.nextBombId = 1;
    this.nextExplosionId = 1;
    this.nextPickupId = 1;

    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i]!;
      const [sc, sr] = SPAWN_TILES[car.slot]!;
      car.x = sc * TILE + TILE / 2;
      car.y = sr * TILE + TILE / 2;
      car.vx = 0;
      car.vy = 0;
      car.alive = true;
      car.speedLevel = 0;
      car.blastRange = DEFAULT_RANGE;
      car.maxBombs = 1;
      car.bombsLeft = 1;
      car.bombCooldownUntil = 0;
      car.nextCp = 0;
      car.angle = car.slot === 0 || car.slot === 2 ? 0 : Math.PI;
    }
  }

  private maxSpeed(car: CarState): number {
    return BASE_SPEED * (1 + car.speedLevel * 0.35);
  }

  private driveCar(car: CarState, input: InputFrame, dt: number): void {
    let ix = 0;
    let iy = 0;
    if (input.left) ix -= 1;
    if (input.right) ix += 1;
    if (input.up) iy -= 1;
    if (input.down) iy += 1;

    if (ix !== 0 && iy !== 0) {
      if (Math.abs(car.vx) >= Math.abs(car.vy)) iy = 0;
      else ix = 0;
    }

    const maxSp = this.maxSpeed(car);
    if (ix !== 0 || iy !== 0) {
      car.angle = Math.atan2(iy, ix);
      car.vx += ix * ACCEL * dt;
      car.vy += iy * ACCEL * dt;
    }

    const drag = Math.exp(-FRICTION * dt);
    if (ix === 0) car.vx *= drag;
    if (iy === 0) car.vy *= drag;

    const sp = Math.hypot(car.vx, car.vy);
    if (sp > maxSp) {
      car.vx = (car.vx / sp) * maxSp;
      car.vy = (car.vy / sp) * maxSp;
    }

    if (ix !== 0 && iy === 0) {
      const cy = Math.floor(car.y / TILE) * TILE + TILE / 2;
      car.y += (cy - car.y) * Math.min(1, dt * 14);
    } else if (iy !== 0 && ix === 0) {
      const cx = Math.floor(car.x / TILE) * TILE + TILE / 2;
      car.x += (cx - car.x) * Math.min(1, dt * 14);
    }

    this.moveAxis(car, car.vx * dt, 0);
    this.moveAxis(car, 0, car.vy * dt);
  }

  private moveAxis(car: CarState, dx: number, dy: number): void {
    const nx = car.x + dx;
    const ny = car.y + dy;
    if (!this.boxHitsSolid(nx, ny, car.id)) {
      car.x = nx;
      car.y = ny;
      return;
    }
    if (dx !== 0) car.vx = 0;
    if (dy !== 0) car.vy = 0;
  }

  private boxHitsSolid(x: number, y: number, selfId: string): boolean {
    const hw = CAR_COLLISION_W / 2;
    const hh = CAR_COLLISION_H / 2;
    const left = x - hw;
    const right = x + hw;
    const top = y - hh;
    const bottom = y + hh;
    const minC = Math.floor(left / TILE);
    const maxC = Math.floor((right - 0.01) / TILE);
    const minR = Math.floor(top / TILE);
    const maxR = Math.floor((bottom - 0.01) / TILE);

    for (let row = minR; row <= maxR; row++) {
      for (let col = minC; col <= maxC; col++) {
        if (!inBounds(col, row)) return true;
        const kind = this.tiles[tileIndex(col, row)];
        if (kind === 'soft' || kind === 'hard') return true;
      }
    }

    for (const b of this.bombs) {
      if (b.ownerId === selfId) {
        const oc = Math.floor(x / TILE);
        const or = Math.floor(y / TILE);
        if (oc === b.col && or === b.row) continue;
      }
      const bx = b.col * TILE + TILE / 2;
      const by = b.row * TILE + TILE / 2;
      if (Math.abs(x - bx) < hw + 10 && Math.abs(y - by) < hh + 10) return true;
    }
    return false;
  }

  private tryPlantBomb(car: CarState, input: InputFrame): void {
    const wasDown = this.prevBombDown.get(car.id) ?? false;
    if (!input.bomb || wasDown) return;
    if (car.bombsLeft <= 0 || this.timeMs < car.bombCooldownUntil) return;

    const col = Math.floor(car.x / TILE);
    const row = Math.floor(car.y / TILE);
    if (!inBounds(col, row)) return;
    if (this.tiles[tileIndex(col, row)] !== 'empty') return;
    if (this.bombs.some((b) => b.col === col && b.row === row)) return;

    this.bombs.push({
      id: `b${this.nextBombId++}`,
      ownerId: car.id,
      col,
      row,
      plantedAt: this.timeMs,
      fuseMs: BOMB_FUSE_MS,
      range: car.blastRange,
    });
    car.bombsLeft -= 1;
    car.bombCooldownUntil = this.timeMs + BOMB_COOLDOWN_MS;
  }

  private stepBot(car: CarState, dt: number): void {
    const input = emptyInput();
    const onCenter =
      Math.abs((car.x % TILE) - TILE / 2) < 6 && Math.abs((car.y % TILE) - TILE / 2) < 6;

    const dirs: Array<keyof Pick<InputFrame, 'up' | 'down' | 'left' | 'right'>> = [
      'up',
      'down',
      'left',
      'right',
    ];
    let facing: (typeof dirs)[number] = 'right';
    const a = car.angle;
    if (Math.abs(a) < 0.4) facing = 'right';
    else if (Math.abs(a - Math.PI) < 0.4 || Math.abs(a + Math.PI) < 0.4) facing = 'left';
    else if (a > 0) facing = 'down';
    else facing = 'up';

    // Race: steer toward next checkpoint
    if (this.mode === 'race') {
      const cp = RACE_CHECKPOINTS[car.nextCp];
      if (cp) {
        const tx = cp.col * TILE + TILE / 2;
        const ty = cp.row * TILE + TILE / 2;
        const dx = tx - car.x;
        const dy = ty - car.y;
        if (Math.abs(dx) > Math.abs(dy)) facing = dx > 0 ? 'right' : 'left';
        else facing = dy > 0 ? 'down' : 'up';
      }
    } else if (onCenter && Math.random() < 0.1) {
      facing = dirs[(Math.random() * 4) | 0]!;
    }

    const probe = { ...car };
    const tryDir = (d: (typeof dirs)[number]) => {
      const fake = emptyInput();
      fake[d] = true;
      const before = { x: probe.x, y: probe.y };
      this.driveCar(probe, fake, 0.05);
      const moved = Math.hypot(probe.x - before.x, probe.y - before.y) > 0.5;
      probe.x = car.x;
      probe.y = car.y;
      probe.vx = car.vx;
      probe.vy = car.vy;
      return moved;
    };
    if (!tryDir(facing)) {
      for (const d of dirs) {
        if (tryDir(d)) {
          facing = d;
          break;
        }
      }
    }
    input[facing] = true;
    if (Math.random() < 0.02 && car.bombsLeft > 0) input.bomb = true;

    this.driveCar(car, input, dt);
    this.tryPlantBomb(car, input);
    this.prevBombDown.set(car.id, input.bomb);
  }

  private tryCollectPickup(car: CarState): void {
    const col = Math.floor(car.x / TILE);
    const row = Math.floor(car.y / TILE);
    const idx = this.pickups.findIndex((p) => p.col === col && p.row === row);
    if (idx < 0) return;
    const [p] = this.pickups.splice(idx, 1);
    if (!p) return;
    if (p.kind === 'speed') car.speedLevel = Math.min(MAX_SPEED_LEVEL, car.speedLevel + 1);
    if (p.kind === 'blast') car.blastRange = Math.min(MAX_RANGE, car.blastRange + 1);
    if (p.kind === 'bomb') {
      car.maxBombs = Math.min(MAX_BOMBS_CAP, car.maxBombs + 1);
      car.bombsLeft = Math.min(car.maxBombs, car.bombsLeft + 1);
    }
  }

  private tryRaceProgress(car: CarState): void {
    const cp = RACE_CHECKPOINTS[car.nextCp];
    if (!cp) return;
    const col = Math.floor(car.x / TILE);
    const row = Math.floor(car.y / TILE);
    if (col !== cp.col || row !== cp.row) return;
    car.nextCp += 1;
    if (car.nextCp < RACE_CHECKPOINTS.length) {
      this.pushToast(`${car.name} → CP${car.nextCp}`);
    } else {
      this.phase = 'ended';
      this.winnerId = car.id;
      this.winnerName = car.name;
      this.message = `${car.name} wins the race!`;
    }
  }

  private updateBombs(): void {
    const due = this.bombs.filter((b) => this.timeMs - b.plantedAt >= b.fuseMs);
    if (!due.length) return;
    this.bombs = this.bombs.filter((b) => this.timeMs - b.plantedAt < b.fuseMs);
    for (const bomb of due) this.detonate(bomb);
  }

  private detonate(bomb: BombState): void {
    const cells = [{ col: bomb.col, row: bomb.row, dist: 0 }];
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [dc, dr] of dirs) {
      for (let i = 1; i <= bomb.range; i++) {
        const c = bomb.col + dc * i;
        const r = bomb.row + dr * i;
        if (!inBounds(c, r)) break;
        const kind = this.tiles[tileIndex(c, r)];
        if (kind === 'hard') break;
        cells.push({ col: c, row: r, dist: i });
        if (kind === 'soft') {
          this.tiles[tileIndex(c, r)] = 'empty';
          this.maybeSpawnPickup(c, r);
          break;
        }
      }
    }

    this.explosions.push({
      id: `e${this.nextExplosionId++}`,
      cells,
      startedAt: this.timeMs,
      durationMs: BLAST_HOLD_MS + 80,
    });

    const chained = this.bombs.filter((b) =>
      cells.some((cell) => cell.col === b.col && cell.row === b.row),
    );
    if (chained.length) {
      this.bombs = this.bombs.filter((b) => !chained.includes(b));
      for (const b of chained) this.detonate(b);
    }

    for (const car of this.cars) {
      if (!car.alive) continue;
      const cc = Math.floor(car.x / TILE);
      const rr = Math.floor(car.y / TILE);
      if (cells.some((cell) => cell.col === cc && cell.row === rr)) {
        car.alive = false;
        car.vx = 0;
        car.vy = 0;
        this.pushToast(`${car.name} eliminated`);
      }
    }

    const owner = this.cars.find((c) => c.id === bomb.ownerId);
    if (owner && owner.alive) {
      owner.bombsLeft = Math.min(owner.maxBombs, owner.bombsLeft + 1);
    }
  }

  private maybeSpawnPickup(col: number, row: number): void {
    if (Math.random() > PICKUP_CHANCE) return;
    const kinds: PickupKind[] = ['speed', 'blast', 'bomb'];
    const kind = kinds[(Math.random() * kinds.length) | 0]!;
    this.pickups.push({ id: `pk${this.nextPickupId++}`, kind, col, row });
  }

  private updateExplosions(): void {
    this.explosions = this.explosions.filter(
      (e) => this.timeMs - e.startedAt < e.durationMs,
    );
  }

  private checkWin(): void {
    if (this.phase !== 'playing') return;
    const alive = this.cars.filter((c) => c.alive);

    if (this.mode === 'race') {
      if (alive.length === 1) {
        this.phase = 'ended';
        this.winnerId = alive[0]!.id;
        this.winnerName = alive[0]!.name;
        this.message = `${alive[0]!.name} wins the race!`;
      } else if (alive.length === 0) {
        this.phase = 'ended';
        this.winnerId = undefined;
        this.winnerName = undefined;
        this.message = 'Draw — all out before Finish';
      }
      return;
    }

    if (alive.length <= 1) {
      this.phase = 'ended';
      if (alive.length === 1) {
        this.winnerId = alive[0]!.id;
        this.winnerName = alive[0]!.name;
        this.message = `${alive[0]!.name} wins!`;
      } else {
        this.winnerId = undefined;
        this.winnerName = undefined;
        this.message = 'Draw — no survivors';
      }
    }
  }

  private pushToast(text: string): void {
    this.toasts.push({
      id: `t${this.nextToastId++}`,
      text,
      until: this.timeMs + 2200,
    });
  }
}

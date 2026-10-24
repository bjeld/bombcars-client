export type TileKind = 'empty' | 'soft' | 'hard';

export type PickupKind = 'speed' | 'blast' | 'bomb';

export interface Vec2 {
  x: number;
  y: number;
}

export interface CarState {
  id: string;
  slot: number; // 0..3 → P1..P4
  name: string;
  human: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  alive: boolean;
  /** Extra speed tiers collected (0..2 → up to ×3). */
  speedLevel: number;
  /** Blast range (default 2, cap 5). */
  blastRange: number;
  /** Max simultaneous bombs (default 1, cap 3). */
  maxBombs: number;
  bombsLeft: number;
  bombCooldownUntil: number;
  ready: boolean;
  color: string;
}

export interface BombState {
  id: string;
  ownerId: string;
  col: number;
  row: number;
  plantedAt: number;
  fuseMs: number;
  range: number;
}

export interface ExplosionCell {
  col: number;
  row: number;
  dist: number;
}

export interface ExplosionState {
  id: string;
  cells: ExplosionCell[];
  startedAt: number;
  durationMs: number;
}

export interface PickupState {
  id: string;
  kind: PickupKind;
  col: number;
  row: number;
}

export interface InputFrame {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  bomb: boolean;
}

/** UI / lobby flow phases. */
export type AppPhase =
  | 'home'
  | 'room'
  | 'countdown'
  | 'playing'
  | 'ended';

export interface Toast {
  id: string;
  text: string;
  until: number;
}

export interface GameSnapshot {
  phase: AppPhase;
  tick: number;
  timeMs: number;
  countdownEndsAt: number;
  roomCode: string;
  cols: number;
  rows: number;
  tiles: TileKind[];
  cars: CarState[];
  bombs: BombState[];
  explosions: ExplosionState[];
  pickups: PickupState[];
  localPlayerId: string;
  aliveCount: number;
  winnerId?: string;
  winnerName?: string;
  toasts: Toast[];
  message?: string;
  /** Solo demo note when only one human and a bot. */
  soloNote?: string;
}

export type ClientCommand =
  | { type: 'create_room' }
  | { type: 'join_room'; code: string }
  | { type: 'set_ready'; ready: boolean }
  | { type: 'start_match' }
  | { type: 'rematch' }
  | { type: 'leave_to_home' }
  | { type: 'input'; playerId: string; input: InputFrame };

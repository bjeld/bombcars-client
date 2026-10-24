export type TileKind = 'empty' | 'soft' | 'hard';

export type PickupKind = 'speed' | 'blast' | 'bomb';

export type MatchMode = 'survivor' | 'race';

export interface Vec2 {
  x: number;
  y: number;
}

export interface CarState {
  id: string;
  slot: number;
  name: string;
  human: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  alive: boolean;
  speedLevel: number;
  blastRange: number;
  maxBombs: number;
  bombsLeft: number;
  bombCooldownUntil: number;
  ready: boolean;
  color: string;
  /** Next race checkpoint index 0..3 (Finish). */
  nextCp: number;
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

export interface CheckpointMarker {
  id: string;
  col: number;
  row: number;
  label: string;
  index: number;
}

export interface InputFrame {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  bomb: boolean;
}

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
  mode: MatchMode;
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
  checkpoints: CheckpointMarker[];
  localPlayerId: string;
  aliveCount: number;
  winnerId?: string;
  winnerName?: string;
  toasts: Toast[];
  message?: string;
  soloNote?: string;
}

export type ClientCommand =
  | { type: 'create_room' }
  | { type: 'join_room'; code: string }
  | { type: 'set_mode'; mode: MatchMode }
  | { type: 'set_ready'; ready: boolean }
  | { type: 'start_match' }
  | { type: 'rematch' }
  | { type: 'leave_to_home' }
  | { type: 'input'; playerId: string; input: InputFrame };

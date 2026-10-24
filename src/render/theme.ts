/** Art v0 style locks — do not invent a different palette. */
export const TILE = 48;
export const COLS = 13;
export const ROWS = 11;
export const ARENA_W = COLS * TILE; // 624
export const ARENA_H = ROWS * TILE; // 528

export const COLOR = {
  backdrop: '#1A1F2E',
  floor: '#2D3548',
  hardWall: '#4A5568',
  softBlock: '#E8A54B',
  ink: '#F4F1EA',
  accent: '#FF5C8A',
  outline: '#1A1F2E',
  bomb: '#2B2B2B',
  bombFuse: '#FF8A3D',
  blastCore: '#FFF6C8',
  blastMid: '#FFB347',
  blastEdge: '#FF5C3A',
  cars: ['#FF4D9A', '#2EE6FF', '#FFE14A', '#7CFF5A'] as const,
} as const;

export const CAR_SPRITE_W = 44;
export const CAR_SPRITE_H = 36;
export const CAR_COLLISION_W = 36;
export const CAR_COLLISION_H = 28;
export const BOMB_SIZE = 28;
export const BLAST_HOLD_MS = 300;
export const BOMB_PULSE_MS = 400;

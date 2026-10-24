import { COLS, ROWS } from '../render/theme';
import type { CheckpointMarker, TileKind } from './types';

/** Classic Bomberman-ish: hard border + pillar grid, soft blocks, clear corner spawns. */
export function createArenaTiles(): TileKind[] {
  const tiles: TileKind[] = new Array(COLS * ROWS).fill('empty');

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      const border = c === 0 || r === 0 || c === COLS - 1 || r === ROWS - 1;
      const pillar = c % 2 === 0 && r % 2 === 0;
      if (border || pillar) tiles[i] = 'hard';
    }
  }

  const clearSpawn = (c: number, r: number) => {
    const nearTL = c <= 2 && r <= 2;
    const nearTR = c >= COLS - 3 && r <= 2;
    const nearBL = c <= 2 && r >= ROWS - 3;
    const nearBR = c >= COLS - 3 && r >= ROWS - 3;
    return nearTL || nearTR || nearBL || nearBR;
  };

  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      const i = r * COLS + c;
      if (tiles[i] !== 'empty') continue;
      if (clearSpawn(c, r)) continue;
      if (((c * 17 + r * 31) % 100) < 55) tiles[i] = 'soft';
    }
  }

  // Keep race route cells open (checkpoints sit on empty floor)
  for (const cp of RACE_CHECKPOINTS) {
    const i = tileIndex(cp.col, cp.row);
    if (tiles[i] === 'soft') tiles[i] = 'empty';
  }

  return tiles;
}

export function tileIndex(col: number, row: number): number {
  return row * COLS + col;
}

export function inBounds(col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col < COLS && row < ROWS;
}

/** Corner spawn tile centers (P1–P4). */
export const SPAWN_TILES: readonly [number, number][] = [
  [1, 1],
  [COLS - 2, 1],
  [1, ROWS - 2],
  [COLS - 2, ROWS - 2],
];

/** CP1 → CP2 → CP3 → Finish (Design race rule). Non-colliding floor overlays. */
export const RACE_CHECKPOINTS: readonly CheckpointMarker[] = [
  { id: 'cp1', col: 3, row: 5, label: '1', index: 0 },
  { id: 'cp2', col: 6, row: 3, label: '2', index: 1 },
  { id: 'cp3', col: 9, row: 7, label: '3', index: 2 },
  { id: 'finish', col: 6, row: 5, label: 'F', index: 3 },
];

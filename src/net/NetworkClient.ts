import type { ClientCommand, GameSnapshot } from '../sim/types';

/**
 * Networking seam — future realtime server implements this.
 * v0 uses LocalLoopback only (authoritative GameSim on the client).
 */
export interface NetworkClient {
  connect(): Promise<void>;
  disconnect(): void;
  send(cmd: ClientCommand): void;
  /** Latest authoritative snapshot (cloned). */
  getSnapshot(): GameSnapshot;
  /** Advance local sim / flush outbound. */
  tick(dtMs: number): void;
}

export type SnapshotListener = (snap: GameSnapshot) => void;

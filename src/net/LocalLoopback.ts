import { GameSim } from '../sim/GameSim';
import type { ClientCommand, GameSnapshot } from '../sim/types';
import type { NetworkClient } from './NetworkClient';

/** Local authoritative loopback — swap for a websocket client later. */
export class LocalLoopback implements NetworkClient {
  private sim = new GameSim();
  private connected = false;

  async connect(): Promise<void> {
    this.connected = true;
  }

  disconnect(): void {
    this.connected = false;
  }

  send(cmd: ClientCommand): void {
    if (!this.connected) return;
    this.sim.applyCommand(cmd);
  }

  getSnapshot(): GameSnapshot {
    return this.sim.getSnapshot();
  }

  tick(dtMs: number): void {
    if (!this.connected) return;
    this.sim.step(dtMs);
  }
}

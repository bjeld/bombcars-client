import type { InputFrame } from '../sim/types';

/** Keyboard: WASD / arrows move, Space bomb, Esc menu (handled by app). */
export class Input {
  private keys = new Set<string>();
  private escPressed = false;

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }

  /** Consume Esc edge (menu). */
  consumeEsc(): boolean {
    const v = this.escPressed;
    this.escPressed = false;
    return v;
  }

  frame(): InputFrame {
    return {
      up: this.has('ArrowUp', 'KeyW'),
      down: this.has('ArrowDown', 'KeyS'),
      left: this.has('ArrowLeft', 'KeyA'),
      right: this.has('ArrowRight', 'KeyD'),
      bomb: this.has('Space'),
    };
  }

  private has(...codes: string[]): boolean {
    return codes.some((c) => this.keys.has(c));
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    this.keys.add(e.code);
    if (e.code === 'Escape') this.escPressed = true;
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onBlur = (): void => {
    this.keys.clear();
  };
}

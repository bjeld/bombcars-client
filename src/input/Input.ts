import type { InputFrame } from '../sim/types';

/** Keyboard + on-screen touch pad (mobile). */
export class Input {
  private keys = new Set<string>();
  private escPressed = false;
  private touch = { up: false, down: false, left: false, right: false, bomb: false };

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

  setTouch(partial: Partial<typeof this.touch>): void {
    Object.assign(this.touch, partial);
  }

  consumeEsc(): boolean {
    const v = this.escPressed;
    this.escPressed = false;
    return v;
  }

  frame(): InputFrame {
    return {
      up: this.has('ArrowUp', 'KeyW') || this.touch.up,
      down: this.has('ArrowDown', 'KeyS') || this.touch.down,
      left: this.has('ArrowLeft', 'KeyA') || this.touch.left,
      right: this.has('ArrowRight', 'KeyD') || this.touch.right,
      bomb: this.has('Space') || this.touch.bomb,
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

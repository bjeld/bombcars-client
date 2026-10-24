import './style.css';
import { Input } from './input/Input';
import { LocalLoopback } from './net/LocalLoopback';
import { Renderer } from './render/Renderer';
import {
  mountApp,
  renderHud,
  renderOverlay,
  renderToast,
  syncScreens,
  wireTouch,
  wireUi,
} from './ui/screens';

async function boot(): Promise<void> {
  const app = document.querySelector<HTMLElement>('#app');
  if (!app) throw new Error('#app missing');

  const net = new LocalLoopback();
  await net.connect();

  const handles = mountApp(app);
  wireUi(net, handles);
  const input = new Input();
  wireTouch(input, handles.root);
  const renderer = new Renderer(handles.canvas);

  let last = performance.now();
  let prevPhase = net.getSnapshot().phase;

  const frame = (now: number): void => {
    const dt = now - last;
    last = now;

    const snap0 = net.getSnapshot();

    if (input.consumeEsc()) {
      if (snap0.phase === 'playing' || snap0.phase === 'countdown' || snap0.phase === 'ended') {
        net.send({ type: 'leave_to_home' });
      } else if (snap0.phase === 'room') {
        net.send({ type: 'leave_to_home' });
      }
    }

    if (snap0.phase === 'playing') {
      const local = snap0.localPlayerId;
      net.send({ type: 'input', playerId: local, input: input.frame() });
    }

    net.tick(dt);
    const snap = net.getSnapshot();

    if (snap.phase !== prevPhase) {
      prevPhase = snap.phase;
    }

    syncScreens(snap, handles.root);

    if (snap.phase === 'countdown' || snap.phase === 'playing' || snap.phase === 'ended') {
      renderer.draw(snap);
      renderHud(snap, handles.hud);
      renderToast(snap, handles.toast);
      renderOverlay(snap, handles.overlay, net);
    }

    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
}

boot().catch((err) => {
  console.error(err);
  document.body.textContent = String(err);
});

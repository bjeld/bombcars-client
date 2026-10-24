import type { GameSnapshot } from '../sim/types';
import type { NetworkClient } from '../net/NetworkClient';
import { COLOR } from '../render/theme';

export interface UiHandles {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  hud: HTMLElement;
  toast: HTMLElement;
  overlay: HTMLElement;
}

export function mountApp(root: HTMLElement): UiHandles {
  root.innerHTML = `
    <div id="screen-home" class="screen active">
      <h1 class="lobby-title">BombCars</h1>
      <p class="lobby-sub">Bomberman × Super Cars — last survivor wins. Local loopback demo.</p>
      <div class="row">
        <button class="btn" id="btn-create" type="button">Create Room</button>
      </div>
      <div class="join-row">
        <input id="join-code" class="code-input" maxlength="6" placeholder="CODE" autocomplete="off" spellcheck="false" />
        <button class="btn btn-ghost" id="btn-join" type="button">Join</button>
      </div>
      <p class="hint">Codes are uppercase stubs — no server yet.</p>
    </div>

    <div id="screen-room" class="screen">
      <h1 class="lobby-title sm">Room</h1>
      <p class="room-code">CODE <strong id="room-code-label">----</strong></p>
      <ul id="roster" class="roster"></ul>
      <p id="solo-note" class="hint"></p>
      <div class="row">
        <button class="btn" id="btn-ready" type="button">Ready</button>
        <button class="btn btn-ghost" id="btn-start" type="button">Start Match</button>
      </div>
      <button class="linkish" id="btn-leave-room" type="button">← Back</button>
    </div>

    <div id="screen-game" class="screen">
      <div class="game-wrap">
        <div id="hud" class="hud"></div>
        <canvas id="game-canvas" width="624" height="528"></canvas>
        <div id="toast" class="toast"></div>
        <div id="overlay" class="overlay"></div>
      </div>
      <p class="hint">WASD / Arrows · Space bomb · Esc menu</p>
    </div>
  `;

  const canvas = root.querySelector<HTMLCanvasElement>('#game-canvas')!;
  const hud = root.querySelector<HTMLElement>('#hud')!;
  const toast = root.querySelector<HTMLElement>('#toast')!;
  const overlay = root.querySelector<HTMLElement>('#overlay')!;
  return { root, canvas, hud, toast, overlay };
}

export function wireUi(net: NetworkClient, handles: UiHandles): void {
  const { root } = handles;
  const joinInput = root.querySelector<HTMLInputElement>('#join-code')!;

  joinInput.addEventListener('input', () => {
    joinInput.value = joinInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

  root.querySelector('#btn-create')!.addEventListener('click', () => {
    net.send({ type: 'create_room' });
  });
  root.querySelector('#btn-join')!.addEventListener('click', () => {
    net.send({ type: 'join_room', code: joinInput.value });
  });
  root.querySelector('#btn-ready')!.addEventListener('click', () => {
    const snap = net.getSnapshot();
    const me = snap.cars.find((c) => c.id === snap.localPlayerId);
    net.send({ type: 'set_ready', ready: !(me?.ready ?? false) });
  });
  root.querySelector('#btn-start')!.addEventListener('click', () => {
    net.send({ type: 'start_match' });
  });
  root.querySelector('#btn-leave-room')!.addEventListener('click', () => {
    net.send({ type: 'leave_to_home' });
  });
}

export function syncScreens(snap: GameSnapshot, root: HTMLElement): void {
  const home = root.querySelector('#screen-home')!;
  const room = root.querySelector('#screen-room')!;
  const game = root.querySelector('#screen-game')!;

  const showGame =
    snap.phase === 'countdown' || snap.phase === 'playing' || snap.phase === 'ended';

  home.classList.toggle('active', snap.phase === 'home');
  room.classList.toggle('active', snap.phase === 'room');
  game.classList.toggle('active', showGame);

  if (snap.phase === 'room') {
    root.querySelector('#room-code-label')!.textContent = snap.roomCode;
    const roster = root.querySelector('#roster')!;
    roster.innerHTML = snap.cars
      .map((c) => {
        const pill = c.ready
          ? `<span class="pill ready">READY</span>`
          : `<span class="pill">…</span>`;
        return `<li><span class="swatch" style="background:${c.color}"></span>${escapeHtml(c.name)}${pill}</li>`;
      })
      .join('');
    const note = root.querySelector('#solo-note')!;
    note.textContent = snap.soloNote ?? '';
    const readyBtn = root.querySelector('#btn-ready')!;
    const me = snap.cars.find((c) => c.id === snap.localPlayerId);
    readyBtn.textContent = me?.ready ? 'Unready' : 'Ready';
  }
}

export function renderHud(snap: GameSnapshot, hud: HTMLElement): void {
  const me = snap.cars.find((c) => c.id === snap.localPlayerId);
  const portraits = snap.cars
    .map((c) => {
      const dim = c.alive ? '1' : '0.35';
      return `<span class="portrait" style="background:${c.color};opacity:${dim}" title="${escapeHtml(c.name)}"></span>`;
    })
    .join('');

  hud.innerHTML = `
    <span class="portraits">${portraits} <strong>${snap.aliveCount}</strong> alive</span>
    <span>Bombs <strong>${me?.bombsLeft ?? 0}/${me?.maxBombs ?? 1}</strong></span>
    <span>Range <strong>${me?.blastRange ?? 2}</strong></span>
    <span>Speed <strong>×${1 + (me?.speedLevel ?? 0)}</strong></span>
  `;
}

export function renderToast(snap: GameSnapshot, el: HTMLElement): void {
  const latest = snap.toasts[snap.toasts.length - 1];
  if (!latest) {
    el.classList.remove('active');
    el.textContent = '';
    return;
  }
  el.classList.add('active');
  el.textContent = latest.text;
}

export function renderOverlay(snap: GameSnapshot, el: HTMLElement, net: NetworkClient): void {
  if (snap.phase === 'countdown') {
    const left = Math.max(0, Math.ceil((snap.countdownEndsAt - snap.timeMs) / 1000));
    el.classList.add('active');
    el.innerHTML = `<h2 style="color:${COLOR.accent}">${left || 'GO'}</h2>`;
    return;
  }
  if (snap.phase === 'ended') {
    el.classList.add('active');
    el.innerHTML = `
      <h2>${escapeHtml(snap.message ?? 'Match over')}</h2>
      <div class="row">
        <button class="btn" id="btn-rematch" type="button">Rematch</button>
        <button class="btn btn-ghost" id="btn-home" type="button">Home</button>
      </div>
    `;
    el.querySelector('#btn-rematch')?.addEventListener('click', () => net.send({ type: 'rematch' }));
    el.querySelector('#btn-home')?.addEventListener('click', () => net.send({ type: 'leave_to_home' }));
    return;
  }
  el.classList.remove('active');
  el.innerHTML = '';
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!,
  );
}

import type { GameSnapshot, MatchMode } from '../sim/types';
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
      <p class="lobby-sub">Top-down arcade racers + bombs. Blow crates, grab power-ups, survive or race to Finish.</p>
      <div class="row">
        <button class="btn" id="btn-create" type="button">Create Room</button>
      </div>
      <div class="join-row">
        <input id="join-code" class="code-input" maxlength="6" placeholder="CODE" autocomplete="off" spellcheck="false" />
        <button class="btn btn-ghost" id="btn-join" type="button">Join</button>
      </div>
      <p class="hint">WASD to drive · Space to bomb · clear soft crates with blasts</p>
    </div>

    <div id="screen-room" class="screen">
      <h1 class="lobby-title sm">Room</h1>
      <p class="room-code">CODE <strong id="room-code-label">----</strong></p>
      <div class="mode-row" id="mode-row">
        <button class="mode-pill active" data-mode="race" type="button">Race</button>
        <button class="mode-pill" data-mode="survivor" type="button">Survivor</button>
      </div>
      <p class="hint" id="mode-hint">Hit CP1 → CP2 → CP3 → Finish. Bombs cut race lines.</p>
      <ul id="roster" class="roster"></ul>
      <p id="solo-note" class="hint"></p>
      <div class="row">
        <button class="btn" id="btn-ready" type="button">Ready</button>
        <button class="btn btn-ghost" id="btn-start" type="button">Start Match</button>
      </div>
      <button class="linkish" id="btn-leave-room" type="button">← Back</button>
    </div>

    <div id="screen-game" class="screen game-screen">
      <div class="game-wrap">
        <div id="hud" class="hud"></div>
        <canvas id="game-canvas" width="624" height="528"></canvas>
        <div id="toast" class="toast"></div>
        <div id="overlay" class="overlay"></div>
        <div id="touch-pad" class="touch-pad">
          <div class="dpad">
            <button type="button" data-dir="up" class="pad-btn">▲</button>
            <div class="dpad-mid">
              <button type="button" data-dir="left" class="pad-btn">◀</button>
              <button type="button" data-dir="right" class="pad-btn">▶</button>
            </div>
            <button type="button" data-dir="down" class="pad-btn">▼</button>
          </div>
          <button type="button" id="btn-bomb" class="bomb-btn">BOMB</button>
        </div>
      </div>
      <p class="hint desktop-only">WASD · Space bomb · Esc</p>
    </div>
  `;

  const canvas = root.querySelector<HTMLCanvasElement>('#game-canvas')!;
  const hud = root.querySelector<HTMLElement>('#hud')!;
  const toast = root.querySelector<HTMLElement>('#toast')!;
  const overlay = root.querySelector<HTMLElement>('#overlay')!;
  return { root, canvas, hud, toast, overlay };
}

export function wireTouch(input: { setTouch: (p: Partial<{up:boolean;down:boolean;left:boolean;right:boolean;bomb:boolean}>) => void }, root: HTMLElement): void {
  const pad = root.querySelector('#touch-pad');
  if (!pad) return;
  const setDir = (dir: string, on: boolean) => {
    if (dir === 'up') input.setTouch({ up: on });
    if (dir === 'down') input.setTouch({ down: on });
    if (dir === 'left') input.setTouch({ left: on });
    if (dir === 'right') input.setTouch({ right: on });
  };
  pad.querySelectorAll<HTMLButtonElement>('.pad-btn').forEach((btn) => {
    const dir = btn.dataset.dir!;
    const start = (e: Event) => { e.preventDefault(); setDir(dir, true); };
    const end = (e: Event) => { e.preventDefault(); setDir(dir, false); };
    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', end);
    btn.addEventListener('pointerleave', end);
    btn.addEventListener('pointercancel', end);
  });
  const bomb = pad.querySelector<HTMLButtonElement>('#btn-bomb')!;
  const bOn = (e: Event) => { e.preventDefault(); input.setTouch({ bomb: true }); };
  const bOff = (e: Event) => { e.preventDefault(); input.setTouch({ bomb: false }); };
  bomb.addEventListener('pointerdown', bOn);
  bomb.addEventListener('pointerup', bOff);
  bomb.addEventListener('pointerleave', bOff);
  bomb.addEventListener('pointercancel', bOff);
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

  root.querySelectorAll<HTMLButtonElement>('.mode-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode as MatchMode;
      net.send({ type: 'set_mode', mode });
    });
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

    root.querySelectorAll<HTMLButtonElement>('.mode-pill').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === snap.mode);
    });
    const hint = root.querySelector('#mode-hint')!;
    hint.textContent =
      snap.mode === 'race'
        ? 'Hit CP1 → CP2 → CP3 → Finish first while alive. Bombs still clear crates.'
        : 'Last car standing wins. Bombs destroy soft crates.';
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

  const raceBit =
    snap.mode === 'race'
      ? `<span>Next <strong>CP${Math.min(3, (me?.nextCp ?? 0) + 1)}${(me?.nextCp ?? 0) >= 3 ? ' Finish' : ''}</strong></span>`
      : `<span class="portraits">${portraits} <strong>${snap.aliveCount}</strong> alive</span>`;

  hud.innerHTML = `
    ${raceBit}
    <span>Bombs <strong>${me?.bombsLeft ?? 0}/${me?.maxBombs ?? 1}</strong></span>
    <span>Range <strong>${me?.blastRange ?? 2}</strong></span>
    <span>Speed <strong>×${(1 + (me?.speedLevel ?? 0) * 0.35).toFixed(2)}</strong></span>
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
    el.innerHTML = `<h2 style="color:${COLOR.accent}">${left || 'GO'}</h2>
      <p style="color:${COLOR.ink};opacity:.8;margin:0">${snap.mode === 'race' ? 'RACE' : 'SURVIVOR'}</p>`;
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

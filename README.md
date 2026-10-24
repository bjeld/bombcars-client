# BombCars Client (v0)

Thin browser demo: **Bomberman × Super Cars**, last-survivor. Local loopback only — `GameSim` is authoritative; `NetworkClient` / `LocalLoopback` is the seam for a future realtime server.

## Run

```bash
cd /workspace/bombcars-client
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

Production build:

```bash
npm run build
npm run preview
```

## Controls

| Input | Action |
|--------|--------|
| **W A S D** or **Arrow keys** | Drive (4-way, snappy lane assist) |
| **Space** | Soft-drop bomb on current tile |
| **Esc** | Back to home / menu |

## Flow (local stubs)

1. **Home** — Create Room, or Join with uppercase code  
2. **Room** — roster + ready pills (a BOT auto-joins in loopback)  
3. **Ready** (or Start Match) → countdown → match  
4. **Last survivor** wins → Rematch / Home  

## Layout

```
src/
  sim/       GameSim, map, types (rules / authority)
  render/    Canvas 2D + theme.ts (Art v0 locks)
  input/     Keyboard
  ui/        Lobby / HUD screens
  net/       NetworkClient + LocalLoopback
```

## Art v0

Constants live in `src/render/theme.ts` (tile 48, arena 624×528, palette locked).

## Known gaps

- No real multiplayer / netcode yet (join codes are local stubs).
- Bot AI is simple wander + occasional bombs.
- No kick / pierce / remote bombs; no respawn (by design for v0).
- Camera peek is subtle; arena fills the view at 1:1.

# Implement Epics 1–6: Scaffolding, Shared Types, Board Engine, Rulesets, State Machines, Room Management & Socket Layer

You are a senior software developer. Work through the tasks below using **strict TDD**: write failing tests first, then implement to make them pass. Commit after each logical unit.

---

## 📚 Reference Documentation

> **Always refer to these official docs when implementing. Do not rely on training data for API signatures — check these links first.**

| Library | Docs URL | Key notes |
|---|---|---|
| **Discord Activities** | https://discord.com/developers/docs/activities/overview | Activities are iframes using the Embedded App SDK. Uses OAuth2 code flow via `discordSdk.commands.authorize()` then `authenticate()` |
| **Building an Activity** | https://discord.com/developers/docs/activities/building-an-activity | App registration, Cloudflare tunnel for local dev, proxying `/api` routes |
| **Embedded App SDK** | https://discord.com/developers/docs/developer-tools/embedded-app-sdk | `DiscordSDK` class, commands, events. Init: `await discordSdk.ready()` → `authorize()` → POST `/api/token` → `authenticate()` |
| **@discord/embedded-app-sdk** | https://github.com/discord/embedded-app-sdk | `import { DiscordSDK } from '@discord/embedded-app-sdk'` |
| **XState v5** | https://stately.ai/docs/xstate | Use `createMachine`, `createActor`, `assign` from `xstate`. **v5 API only** — `assign` uses `({ context, event }) =>` syntax. Do NOT use v4 patterns. |
| **@xstate/react** | https://github.com/statelyai/xstate/tree/main/packages/xstate-react | `useActor`, `useMachine` hooks |
| **Socket.IO v4 Server** | https://socket.io/docs/v4/server-api/ | Use typed `Server<ClientToServerEvents, ServerToClientEvents>`. Socket.IO is NOT raw WebSocket. |
| **Socket.IO v4 Client** | https://socket.io/docs/v4/client-api/ | For integration tests: `import { io } from 'socket.io-client'` |
| **Vitest** | https://vitest.dev/guide/ | Requires Vite >=6, Node >=20. Use `globals: true` to avoid importing `describe/it/expect`. Run once: `vitest run` |
| **Express 5** | https://expressjs.com/en/5x/api.html | Requires Node >=18. Built-in `express.json()`. Async error handling differs from v4. |

---

## Commit format

```
feat(e1-monorepo): <description>

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

Use `feat:`, `test:`, or `chore:` prefixes. Always include the `Co-authored-by` trailer. Reference closed issues in commits with `Closes #N`.

---

## Work order

### Step 1 — Epic 1: Finish scaffolding (Closes #1 #2 #3 #4 #5 #6 #7 #8)

The root monorepo already exists (`pnpm-workspace.yaml`, `tsconfig.base.json`, root `README.md`). Create the three packages:

**`shared/package.json`:**
```json
{
  "name": "shared",
  "version": "0.0.1",
  "main": "./types/index.ts",
  "types": "./types/index.ts"
}
```

**`shared/tsconfig.json`** — extend `../../tsconfig.base.json`, include `types/**/*`

**`server/package.json`:**
```json
{
  "name": "server",
  "private": true,
  "scripts": {
    "dev": "ts-node src/app.ts",
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "express": "^5.0.0",
    "socket.io": "^4.8.0",
    "dotenv": "^16.0.0",
    "xstate": "^5.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/express": "^5.0.0",
    "@types/node": "^20.0.0",
    "ts-node": "^10.9.0",
    "vitest": "^2.0.0",
    "socket.io-client": "^4.8.0"
  }
}
```

**`server/tsconfig.json`:**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "dist",
    "rootDir": "src",
    "paths": {
      "shared": ["../shared/types/index.ts"]
    }
  },
  "include": ["src/**/*"]
}
```

**`server/vitest.config.ts`:**
```ts
import { defineConfig } from 'vitest/config'
import path from 'path'
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      shared: path.resolve(__dirname, '../shared/types/index.ts'),
    },
  },
})
```

**`server/.env.example`:**
```
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_CLIENT_SECRET=your_client_secret_here
PORT=3000
CLIENT_URL=http://localhost:5173
```

**`server/src/config.ts`:**
```ts
import 'dotenv/config'
export const config = {
  port: Number(process.env.PORT ?? 3000),
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  discord: {
    clientId: process.env.DISCORD_CLIENT_ID ?? '',
    clientSecret: process.env.DISCORD_CLIENT_SECRET ?? '',
  },
  isDev: process.env.NODE_ENV !== 'production',
}
```

**`client/package.json`:**
```json
{
  "name": "client",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "xstate": "^5.0.0",
    "@xstate/react": "^4.0.0",
    "@discord/embedded-app-sdk": "latest"
  },
  "devDependencies": {
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "typescript": "^5.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "vitest": "^2.0.0",
    "jsdom": "^25.0.0",
    "@vitest/ui": "^2.0.0"
  }
}
```

**`client/tsconfig.json`:**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "paths": {
      "shared": ["../shared/types/index.ts"]
    }
  },
  "include": ["src/**/*"]
}
```

**`client/vite.config.ts`:**
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      shared: path.resolve(__dirname, '../shared/types/index.ts'),
    },
  },
})
```

**`client/src/main.tsx`** — minimal placeholder:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

**`client/src/App.tsx`** — minimal placeholder:
```tsx
export default function App() {
  return <div>Discord Sudoku — coming soon</div>
}
```

**`client/index.html`:**
```html
<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /><title>Discord Sudoku</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
```

Write `shared/README.md`, `server/README.md`, `client/README.md` — concise but complete (types exported, env vars, how to run, architecture notes).

Run `pnpm install` at the root after creating all `package.json` files. Confirm `pnpm test` (server) passes (no tests yet = passes).

---

### Step 2 — Epic 2: Shared types & Board engine (Closes #9 #10 #11 #12)

**`shared/types/board.ts`:**
```ts
export interface CellCoord { row: number; col: number }

export interface Cell {
  value: number | null
  isGiven: boolean
  cornerNotes: number[]
  centerNotes: number[]
  isConflict: boolean
  placedBy?: string
}

export type BoardGrid = Cell[][]

export interface BoardMetadata {
  thermometers?: CellCoord[][]
  cages?: { cells: CellCoord[]; sum: number }[]
}
```

**`shared/types/room.ts`:**
```ts
import type { BoardGrid, BoardMetadata } from './board'

export type RoomPhase = 'LOBBY' | 'SETUP' | 'PLAYING' | 'COMPLETED'

export interface PlayerInfo {
  id: string
  username: string
  avatar: string
  colour: string
  socketId: string
  isHost: boolean
}

export interface GameStats {
  elapsedMs: number
  contributions: { playerId: string; count: number }[]
}

export interface RoomState {
  phase: RoomPhase
  board: BoardGrid
  metadata: BoardMetadata
  players: PlayerInfo[]
  rulesetId: string
  stats?: GameStats
}
```

**`shared/types/ruleset.ts`:**
```ts
import type { BoardGrid, BoardMetadata, CellCoord } from './board'

export interface Ruleset {
  id: string
  name: string
  validate(
    board: BoardGrid,
    metadata: BoardMetadata,
    row: number,
    col: number,
    value: number
  ): CellCoord[]
  renderHints?: unknown
}
```

**`shared/types/events.ts`** — fully typed Socket.IO event maps:
```ts
import type { Cell, CellCoord } from './board'
import type { RoomPhase, PlayerInfo, GameStats, RoomState } from './room'

export interface ClientToServerEvents {
  join_room: (data: { channelId: string; userId: string; username: string; avatar: string }) => void
  begin_setup: () => void
  place_given: (data: { row: number; col: number; value: number }) => void
  clear_given: (data: { row: number; col: number }) => void
  start_game: () => void
  set_ruleset: (data: { rulesetId: string }) => void
  place_digit: (data: { row: number; col: number; value: number }) => void
  clear_cell: (data: { row: number; col: number }) => void
  toggle_note: (data: { row: number; col: number; noteType: 'corner' | 'center'; value: number }) => void
  cursor_moved: (data: { row: number | null; col: number | null }) => void
}

export interface ServerToClientEvents {
  room_state: (state: RoomState) => void
  cell_updated: (data: { row: number; col: number; cell: Cell; conflicts: CellCoord[] }) => void
  player_joined: (player: PlayerInfo) => void
  player_left: (data: { playerId: string }) => void
  host_changed: (data: { newHostId: string }) => void
  phase_changed: (data: { phase: RoomPhase }) => void
  cursor_updated: (data: { playerId: string; row: number | null; col: number | null }) => void
  game_completed: (data: { stats: GameStats }) => void
}
```

**`shared/types/index.ts`** — re-export everything from all type files.

---

**TDD — Board module** (`server/src/board/board.test.ts` FIRST, then `board.ts`):

Board module exports pure functions (immutable — always return new `BoardGrid`):
- `createEmpty(): BoardGrid`
- `placeGiven(board, row, col, value): BoardGrid` — throws if cell already given
- `clearGiven(board, row, col): BoardGrid` — throws if cell is not given
- `placeDigit(board, row, col, value, playerId): BoardGrid` — no-op if given; clears notes in same cell
- `clearCell(board, row, col): BoardGrid` — no-op if given
- `toggleNote(board, row, col, noteType: 'corner' | 'center', value): BoardGrid`
- `isComplete(board): boolean` — true only if all non-given cells have a value AND no cell has `isConflict: true`
- `applyConflicts(board, conflicts: CellCoord[]): BoardGrid` — marks listed cells as conflict, clears all others
- `clearConflicts(board): BoardGrid`

Write ALL of these tests before writing any implementation:
1. `createEmpty()` returns 9×9 array, all `value: null`, all `isGiven: false`, all notes `[]`
2. `placeGiven()` sets `value` and `isGiven: true` at correct coords
3. `placeGiven()` is immutable — original board unchanged
4. `placeGiven()` throws if cell is already given
5. `clearGiven()` clears `value` and `isGiven`
6. `clearGiven()` throws if cell is not given
7. `placeDigit()` sets `value` and `placedBy`, clears `cornerNotes` and `centerNotes`
8. `placeDigit()` is a no-op when cell is `isGiven: true`
9. `placeDigit()` is immutable — original board unchanged
10. `clearCell()` clears value, notes, and placedBy on a non-given cell
11. `clearCell()` is a no-op on a given cell
12. `toggleNote()` adds a corner note when not present
13. `toggleNote()` removes a corner note when already present
14. `toggleNote()` works independently for center notes
15. `isComplete()` returns `false` when any non-given cell has `value: null`
16. `isComplete()` returns `false` when any cell has `isConflict: true`
17. `isComplete()` returns `true` when all non-given cells are filled and no conflicts
18. `applyConflicts()` marks only listed cells as `isConflict: true`, all others `false`
19. `clearConflicts()` sets all cells to `isConflict: false`

---

### Step 3 — Epic 3: Ruleset plugin system (Closes #13 #14 #15 #16 #17 #18 #19)

**`server/src/rulesets/index.ts`** — `RulesetRegistry`:
```ts
// Map of id -> Ruleset. Call register() to add new rulesets.
// get(id) returns the ruleset or throws if not found.
```
Auto-registers `BaseRuleset` on import.

**TDD each ruleset — write test file first, then implement:**

**BaseRuleset tests** (`baseRuleset.test.ts`):
1. Valid placement — no duplicates in row, col, or 3×3 box → returns `[]`
2. Row conflict — same value already in same row → returns coords of both conflicting cells
3. Column conflict — same value already in same column
4. Box conflict — same value already in same 3×3 box
5. Multiple conflicts — row + col both conflict → all conflict coords returned (deduped)
6. Given cells count as conflict sources (isGiven=true cells are not exempt)

**ThermometerRuleset tests** (`thermometerRuleset.test.ts`):
Thermometer = ordered array of `CellCoord[]`; values must strictly increase from index 0 to last.
1. Cell not on any thermometer → no conflict
2. Single-cell thermometer → always valid
3. Strictly increasing values → valid, returns `[]`
4. Equal values on thermometer → returns conflict coords for both equal cells
5. Decreasing value → conflict
6. Partially filled thermometer with valid increasing values → no conflict

**CageRuleset tests** (`cageRuleset.test.ts`):
Cage = `{ cells: CellCoord[], sum: number }`. No repeated digits; sum checked only when fully filled.
1. Cell not in any cage → no conflict
2. Duplicate digit in same cage → returns all cells in that cage as conflicts
3. Cage not fully filled → no sum check → valid
4. Cage fully filled, correct sum → valid, returns `[]`
5. Cage fully filled, wrong sum → returns all cells in cage as conflicts

---

### Step 4 — Epic 4: State machines (Closes #20 #21 #22 #23)

Use **XState v5**. See docs at https://stately.ai/docs/xstate — use `createMachine`, `createActor`, `assign` from `xstate`. Do NOT use v4 patterns.

**Write `server/src/machines/roomMachine.test.ts` first**, then implement `roomMachine.ts`.

Machine context:
```ts
{
  board: BoardGrid
  metadata: BoardMetadata
  players: PlayerInfo[]
  hostId: string
  rulesetId: string
  startedAt: number | null
  stats: GameStats | null
}
```

States: `LOBBY` → `SETUP` → `PLAYING` → `COMPLETED`

Events:
- `BEGIN_SETUP` — guard: sender is host → LOBBY → SETUP
- `START_GAME` — guard: sender is host AND at least one `isGiven` cell → SETUP → PLAYING; set `startedAt`
- `RESET_BOARD` — SETUP: clear board; COMPLETED → SETUP
- `PLACE_DIGIT` — PLAYING only; after update, if `isComplete(board)` → auto-transition to COMPLETED, capture stats
- `JOIN` / `LEAVE` — valid in all states, update `players` in context

Tests:
1. Initial state is `LOBBY`
2. `BEGIN_SETUP` from LOBBY → SETUP when sender is host
3. `BEGIN_SETUP` ignored when sender is not host (stays in LOBBY)
4. `START_GAME` rejected when no givens on board
5. `START_GAME` succeeds with at least one given → state is `PLAYING`, `startedAt` is set
6. `RESET_BOARD` in SETUP clears board, remains in SETUP
7. `PLACE_DIGIT` on incomplete board → stays in PLAYING
8. `PLACE_DIGIT` completing the board → transitions to COMPLETED, `stats` captured in context
9. `RESET_BOARD` in COMPLETED → SETUP, board cleared
10. `JOIN` accepted in LOBBY without phase change
11. `LEAVE` accepted in PLAYING without phase change

**Client UI machine** (`client/src/machines/uiMachine.ts`):
States: `CONNECTING` → `LOBBY` → `SETUP` → `PLAYING` → `COMPLETED`
Transitions driven by socket events (`phase_changed`). No guards.

Tests (`client/src/machines/uiMachine.test.ts`):
1. Initial state is `CONNECTING`
2. `SOCKET_CONNECTED` → `LOBBY`
3. `PHASE_CHANGED { phase: 'SETUP' }` → `SETUP`
4. `PHASE_CHANGED { phase: 'PLAYING' }` → `PLAYING`
5. `PHASE_CHANGED { phase: 'COMPLETED' }` → `COMPLETED`
6. `PHASE_CHANGED { phase: 'SETUP' }` from COMPLETED → `SETUP` (reset)

---

### Step 5 — Epic 5: Room management (Closes #24 #25 #26 #27 #28)

**TDD — write tests first for each file.**

**`server/src/rooms/player.ts`:**
```ts
export const PLAYER_COLOURS = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#e91e63']

export function assignColour(index: number): string {
  return PLAYER_COLOURS[index % PLAYER_COLOURS.length]
}

export interface Player {
  id: string
  username: string
  avatar: string
  colour: string
  socketId: string
  isHost: boolean
}
```

**`server/src/rooms/room.ts`** — `Room` class:
- Constructor: `(channelId: string, hostPlayer: Player, rulesetId = 'base')`
- Holds: `board: BoardGrid`, `metadata: BoardMetadata`, `players: Player[]`, XState actor, `channelId`
- `addPlayer(player: Player): void`
- `removePlayer(socketId: string): { empty: boolean; newHostId?: string }` — if host left and others remain, promote next player
- `getState(): RoomState`
- `sendToMachine(event): void` — forwards events to XState actor

**`server/src/rooms/roomManager.ts`** — singleton `RoomManager`:
- `getOrCreate(channelId: string, hostPlayer: Player): Room`
- `get(channelId: string): Room | undefined`
- `destroy(channelId: string): void`

**Room tests** (`room.test.ts`):
1. First player to join is set as host (`isHost: true`)
2. Second player to join gets a different colour and `isHost: false`
3. `removePlayer` of non-host — player removed, host unchanged
4. `removePlayer` of host — next player promoted to host, returned `newHostId` matches
5. `removePlayer` last player — returns `{ empty: true }`

**RoomManager tests** (`roomManager.test.ts`):
1. `getOrCreate` creates a new room for a new channelId
2. `getOrCreate` returns the existing room for the same channelId
3. `destroy` removes the room from the map
4. `get` returns `undefined` for an unknown channelId

---

### Step 6 — Epic 6: Socket handlers + integration tests (Closes #29 #30 #31 #32 #33 #34 #35 #36)

**Write `server/src/socket/handlers.test.ts` FIRST**, then implement `handlers.ts`.

**`server/src/app.ts`:**
```ts
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from 'shared'
import { config } from './config'
import { registerHandlers } from './socket/handlers'

const app = express()
const httpServer = createServer(app)
export const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: config.clientUrl },
})

app.get('/health', (_req, res) => res.json({ ok: true }))

io.on('connection', (socket) => registerHandlers(io, socket))

export { httpServer }

if (require.main === module) {
  httpServer.listen(config.port, () =>
    console.log(`Server running on port ${config.port}`)
  )
}
```

**`server/src/socket/handlers.ts`** — implement all handlers:
- `join_room` — `getOrCreate` room, add player, emit `room_state` to joiner, broadcast `player_joined` to rest of room
- `begin_setup` — host only; send `BEGIN_SETUP` to machine; broadcast `phase_changed`
- `place_given` — host only in SETUP; call `placeGiven()` on board; broadcast `cell_updated`
- `clear_given` — host only in SETUP; call `clearGiven()`; broadcast `cell_updated`
- `start_game` — host only; send `START_GAME` to machine (guard checked); broadcast `phase_changed`
- `set_ruleset` — host only in SETUP; update rulesetId; re-validate all placed digits with new ruleset; broadcast full `room_state`
- `place_digit` — PLAYING only; call `placeDigit()`, run `registry.get(rulesetId).validate()`, `applyConflicts()`, check `isComplete()`. If complete: capture stats, broadcast `game_completed`. Else broadcast `cell_updated`
- `clear_cell` — PLAYING; call `clearCell()`, re-validate, broadcast `cell_updated`
- `toggle_note` — PLAYING; call `toggleNote()`, broadcast `cell_updated`
- `cursor_moved` — PLAYING; broadcast `cursor_updated` to all others in room (`socket.to(roomId).emit(...)`)
- `disconnect` — remove player; if room empty destroy it; else broadcast `player_left` (and `host_changed` if needed)

**Integration tests** (spin up real server, use `socket.io-client`):

```ts
// Setup pattern:
import { createServer } from 'http'
import { Server } from 'socket.io'
import { io as Client } from 'socket.io-client'
import type { AddressInfo } from 'net'

// httpServer.listen(0) for random port
// const port = (httpServer.address() as AddressInfo).port
// const client = Client(`http://localhost:${port}`)
```

Tests:
1. Two clients join same channelId → both receive `room_state`; second client receives `player_joined`
2. Host sends `begin_setup` → both clients receive `phase_changed { phase: 'SETUP' }`
3. Host sends `place_given` → both clients receive `cell_updated` with correct cell data
4. Host sends `start_game` → both clients receive `phase_changed { phase: 'PLAYING' }`
5. Client places a digit → other client receives `cell_updated`
6. Client sends `cursor_moved` → other client receives `cursor_updated` with correct playerId
7. All non-given cells filled with valid digits → both clients receive `game_completed` with stats
8. Host disconnects → remaining client receives `host_changed` with new host's id
9. Last client disconnects → room is destroyed (verify `roomManager.get(channelId)` returns `undefined`)

---

### Step 7 — Epic 9 (partial): Build scripts (Closes #52 #53)

Ensure `server/package.json` has a working `build` script (`tsc`).
Ensure `client/package.json` has a working `build` script (`vite build`).
Add root `pnpm build` script that builds `shared` then `server` then `client` in sequence.

---

## After all steps

1. Run `pnpm --filter server test` — all tests must pass
2. Run `pnpm --filter client test` — all tests must pass
3. Fix any failures before finishing
4. Push to `origin main`
5. Do NOT implement the client frontend UI (Epics 7–9) — that is for a future session after Discord app registration is complete
6. Do NOT attempt to register the Discord application (issue #37) — that requires manual portal access

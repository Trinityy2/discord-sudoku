# Discord Sudoku Activity

A collaborative Sudoku Discord Activity — play Sudoku together with friends inside a Discord voice channel or DM.

## What it is

A real-time collaborative tool where a group of players share a single Sudoku board. One player (the host) sets up the puzzle by entering the given clues; everyone then works together to solve it. Supports multiple rulesets (Standard, Thermometer, Killer/Cage) with real-time conflict highlighting.

## Monorepo Structure

```
discord_sudoku/
├── client/       # React + Vite Discord Activity frontend
├── server/       # Node.js + Express + Socket.IO backend
└── shared/       # Shared TypeScript types (no runtime deps)
```

## Prerequisites

- Node.js >= 20
- pnpm >= 9 (`npm install -g pnpm`)

## Install

```bash
pnpm install
```

## Development

```bash
# Terminal 1 — backend
pnpm dev:server

# Terminal 2 — frontend
pnpm dev:client
```

## Tests

```bash
# All tests
pnpm test

# Server only
pnpm --filter server test

# Watch mode
pnpm --filter server test -- --watch
```

## Build

```bash
pnpm build
```

## Copilot Cloud Agent Handoff

Use these steps when delegating issue work to the cloud agent from Copilot CLI:

1. Start Copilot CLI from the repository root:
   ```bash
   cd /home/runner/work/discord-sudoku/discord-sudoku
   copilot
   ```
2. (Optional) Select your preferred model (for example, Claude Sonnet 4.6) with `/model`.
3. Run `/delegate` with a short prompt that points to the issue:
   ```
   Work on GitHub issue #56 in Trinityy2/discord-sudoku. Read the full issue body for all instructions.
   ```

If `/delegate` reports `not a git repository`, exit the CLI and relaunch it from this repository root path.

## Architecture

See individual package READMEs:
- [`server/README.md`](server/README.md) — room state machine, ruleset plugin system, socket events
- [`client/README.md`](client/README.md) — XState UI machine, component structure
- [`shared/README.md`](shared/README.md) — shared types reference

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, XState v5, @xstate/react |
| Backend | Node.js, Express, Socket.IO, TypeScript, XState v5 |
| Shared | TypeScript types only |
| Testing | Vitest |
| Real-time | Socket.IO |
| Discord | @discord/embedded-app-sdk |

# server

Express 5 + Socket.IO v4 backend for Discord Sudoku.

## Architecture

- **board/** — Pure board engine functions (immutable)
- **rulesets/** — Pluggable validation system (base, thermometer, cage)
- **machines/** — XState v5 room state machine
- **rooms/** — Room and RoomManager classes
- **socket/** — Socket.IO event handlers

## Running

```bash
pnpm dev
```

## Testing

```bash
pnpm test
```

import { createMachine } from 'xstate'

type UiEvent =
  | { type: 'SOCKET_CONNECTED' }
  | { type: 'PHASE_CHANGED'; phase: 'LOBBY' | 'SETUP' | 'PLAYING' | 'COMPLETED' }

export const uiMachine = createMachine({
  id: 'ui',
  initial: 'CONNECTING',
  states: {
    CONNECTING: {
      on: {
        SOCKET_CONNECTED: { target: 'LOBBY' },
      },
    },
    LOBBY: {
      on: {
        PHASE_CHANGED: [
          { guard: ({ event }) => event.phase === 'SETUP', target: 'SETUP' },
          { guard: ({ event }) => event.phase === 'PLAYING', target: 'PLAYING' },
          { guard: ({ event }) => event.phase === 'COMPLETED', target: 'COMPLETED' },
        ],
      },
    },
    SETUP: {
      on: {
        PHASE_CHANGED: [
          { guard: ({ event }) => event.phase === 'PLAYING', target: 'PLAYING' },
          { guard: ({ event }) => event.phase === 'COMPLETED', target: 'COMPLETED' },
          { guard: ({ event }) => event.phase === 'LOBBY', target: 'LOBBY' },
        ],
      },
    },
    PLAYING: {
      on: {
        PHASE_CHANGED: [
          { guard: ({ event }) => event.phase === 'COMPLETED', target: 'COMPLETED' },
          { guard: ({ event }) => event.phase === 'SETUP', target: 'SETUP' },
          { guard: ({ event }) => event.phase === 'LOBBY', target: 'LOBBY' },
        ],
      },
    },
    COMPLETED: {
      on: {
        PHASE_CHANGED: [
          { guard: ({ event }) => event.phase === 'SETUP', target: 'SETUP' },
          { guard: ({ event }) => event.phase === 'LOBBY', target: 'LOBBY' },
          { guard: ({ event }) => event.phase === 'PLAYING', target: 'PLAYING' },
        ],
      },
    },
  },
})

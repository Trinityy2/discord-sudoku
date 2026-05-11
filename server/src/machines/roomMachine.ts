import { createMachine, assign } from 'xstate'
import type { BoardGrid, BoardMetadata, PlayerInfo, GameStats, CellCoord } from 'shared'
import { createEmpty, placeDigit, clearCell, toggleNote, applyConflicts, isComplete, placeGiven, clearGiven } from '../board/board'

interface RoomContext {
  board: BoardGrid
  metadata: BoardMetadata
  players: PlayerInfo[]
  hostId: string
  rulesetId: string
  startedAt: number | null
  stats: GameStats | null
}

type RoomEvent =
  | { type: 'BEGIN_SETUP'; senderId: string }
  | { type: 'START_GAME'; senderId: string }
  | { type: 'RESET_BOARD' }
  | { type: 'PLACE_DIGIT'; row: number; col: number; value: number; playerId: string; conflicts: CellCoord[] }
  | { type: 'CLEAR_CELL'; row: number; col: number }
  | { type: 'TOGGLE_NOTE'; row: number; col: number; noteType: 'corner' | 'center'; value: number }
  | { type: 'JOIN'; player: PlayerInfo }
  | { type: 'LEAVE'; playerId: string }
  | { type: 'SET_RULESET'; rulesetId: string }
  | { type: 'PLACE_GIVEN'; row: number; col: number; value: number }
  | { type: 'CLEAR_GIVEN'; row: number; col: number }

export function createRoomMachine(initialContext: RoomContext) {
  return createMachine({
    types: {} as { context: RoomContext; events: RoomEvent },
    id: 'room',
    initial: 'LOBBY',
    context: initialContext,
    states: {
      LOBBY: {
        on: {
          BEGIN_SETUP: {
            guard: ({ context, event }) => event.senderId === context.hostId,
            target: 'SETUP',
          },
          JOIN: {
            actions: assign({
              players: ({ context, event }) => [...context.players, event.player],
            }),
          },
          LEAVE: {
            actions: assign({
              players: ({ context, event }) => context.players.filter(p => p.id !== event.playerId),
            }),
          },
        },
      },
      SETUP: {
        on: {
          START_GAME: {
            guard: ({ context, event }) => {
              if (event.senderId !== context.hostId) return false
              return context.board.some(row => row.some(cell => cell.isGiven))
            },
            target: 'PLAYING',
            actions: assign({
              startedAt: () => Date.now(),
            }),
          },
          RESET_BOARD: {
            actions: assign({
              board: () => createEmpty(),
            }),
          },
          SET_RULESET: {
            actions: assign({
              rulesetId: ({ event }) => event.rulesetId,
            }),
          },
          PLACE_GIVEN: {
            actions: assign({
              board: ({ context, event }) => placeGiven(context.board, event.row, event.col, event.value),
            }),
          },
          CLEAR_GIVEN: {
            actions: assign({
              board: ({ context, event }) => clearGiven(context.board, event.row, event.col),
            }),
          },
          JOIN: {
            actions: assign({
              players: ({ context, event }) => [...context.players, event.player],
            }),
          },
          LEAVE: {
            actions: assign({
              players: ({ context, event }) => context.players.filter(p => p.id !== event.playerId),
            }),
          },
        },
      },
      PLAYING: {
        on: {
          PLACE_DIGIT: [
            {
              guard: ({ context, event }) => {
                const updatedBoard = applyConflicts(
                  placeDigit(context.board, event.row, event.col, event.value, event.playerId),
                  event.conflicts
                )
                return isComplete(updatedBoard)
              },
              target: 'COMPLETED',
              actions: assign({
                board: ({ context, event }) => {
                  const updatedBoard = placeDigit(context.board, event.row, event.col, event.value, event.playerId)
                  return applyConflicts(updatedBoard, event.conflicts)
                },
                stats: ({ context, event }) => {
                  const elapsedMs = context.startedAt ? Date.now() - context.startedAt : 0
                  const contributions: { playerId: string; count: number }[] = []
                  const updatedBoard = placeDigit(context.board, event.row, event.col, event.value, event.playerId)
                  for (let r = 0; r < 9; r++) {
                    for (let c = 0; c < 9; c++) {
                      const cell = updatedBoard[r][c]
                      if (!cell.isGiven && cell.placedBy) {
                        const existing = contributions.find(x => x.playerId === cell.placedBy)
                        if (existing) {
                          existing.count++
                        } else {
                          contributions.push({ playerId: cell.placedBy, count: 1 })
                        }
                      }
                    }
                  }
                  return { elapsedMs, contributions }
                },
              }),
            },
            {
              actions: assign({
                board: ({ context, event }) => {
                  const updatedBoard = placeDigit(context.board, event.row, event.col, event.value, event.playerId)
                  return applyConflicts(updatedBoard, event.conflicts)
                },
              }),
            },
          ],
          CLEAR_CELL: {
            actions: assign({
              board: ({ context, event }) => {
                const updatedBoard = clearCell(context.board, event.row, event.col)
                return applyConflicts(updatedBoard, event.conflicts)
              },
            }),
          },
          TOGGLE_NOTE: {
            actions: assign({
              board: ({ context, event }) => toggleNote(context.board, event.row, event.col, event.noteType, event.value),
            }),
          },
          JOIN: {
            actions: assign({
              players: ({ context, event }) => [...context.players, event.player],
            }),
          },
          LEAVE: {
            actions: assign({
              players: ({ context, event }) => context.players.filter(p => p.id !== event.playerId),
            }),
          },
        },
      },
      COMPLETED: {
        on: {
          RESET_BOARD: {
            target: 'SETUP',
            actions: assign({
              board: () => createEmpty(),
              stats: () => null,
            }),
          },
          JOIN: {
            actions: assign({
              players: ({ context, event }) => [...context.players, event.player],
            }),
          },
          LEAVE: {
            actions: assign({
              players: ({ context, event }) => context.players.filter(p => p.id !== event.playerId),
            }),
          },
        },
      },
    },
  })
}

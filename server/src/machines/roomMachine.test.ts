import { describe, it, expect, beforeEach } from 'vitest'
import { createActor } from 'xstate'
import { createRoomMachine } from './roomMachine'
import { createEmpty, placeGiven, placeDigit } from '../board/board'
import type { PlayerInfo, BoardGrid } from 'shared'

const hostPlayer: PlayerInfo = {
  id: 'host-1',
  username: 'Host',
  avatar: '',
  colour: '#red',
  socketId: 'socket-host',
  isHost: true,
}

const player2: PlayerInfo = {
  id: 'player-2',
  username: 'Player2',
  avatar: '',
  colour: '#blue',
  socketId: 'socket-2',
  isHost: false,
}

function makeActor(board = createEmpty()) {
  const machine = createRoomMachine({
    board,
    metadata: {},
    players: [hostPlayer],
    hostId: 'host-1',
    rulesetId: 'base',
    startedAt: null,
    stats: null,
  })
  const actor = createActor(machine)
  actor.start()
  return actor
}

describe('roomMachine', () => {
  it('initial state is LOBBY', () => {
    const actor = makeActor()
    expect(actor.getSnapshot().value).toBe('LOBBY')
  })

  it('BEGIN_SETUP from LOBBY → SETUP when sender is host', () => {
    const actor = makeActor()
    actor.send({ type: 'BEGIN_SETUP', senderId: 'host-1' })
    expect(actor.getSnapshot().value).toBe('SETUP')
  })

  it('BEGIN_SETUP ignored when sender is not host', () => {
    const actor = makeActor()
    actor.send({ type: 'BEGIN_SETUP', senderId: 'not-host' })
    expect(actor.getSnapshot().value).toBe('LOBBY')
  })

  it('START_GAME rejected when no givens on board', () => {
    const actor = makeActor()
    actor.send({ type: 'BEGIN_SETUP', senderId: 'host-1' })
    actor.send({ type: 'START_GAME', senderId: 'host-1' })
    expect(actor.getSnapshot().value).toBe('SETUP')
  })

  it('START_GAME succeeds with at least one given → PLAYING, startedAt is set', () => {
    const board = placeGiven(createEmpty(), 0, 0, 5)
    const actor = makeActor(board)
    actor.send({ type: 'BEGIN_SETUP', senderId: 'host-1' })
    actor.send({ type: 'START_GAME', senderId: 'host-1' })
    expect(actor.getSnapshot().value).toBe('PLAYING')
    expect(actor.getSnapshot().context.startedAt).not.toBeNull()
  })

  it('RESET_BOARD in SETUP clears board, remains in SETUP', () => {
    const board = placeGiven(createEmpty(), 0, 0, 5)
    const actor = makeActor(board)
    actor.send({ type: 'BEGIN_SETUP', senderId: 'host-1' })
    actor.send({ type: 'RESET_BOARD' })
    expect(actor.getSnapshot().value).toBe('SETUP')
    expect(actor.getSnapshot().context.board[0][0].value).toBeNull()
  })

  it('PLACE_DIGIT on incomplete board → stays in PLAYING', () => {
    const board = placeGiven(createEmpty(), 0, 0, 5)
    const actor = makeActor(board)
    actor.send({ type: 'BEGIN_SETUP', senderId: 'host-1' })
    actor.send({ type: 'START_GAME', senderId: 'host-1' })
    actor.send({ type: 'PLACE_DIGIT', row: 1, col: 0, value: 3, playerId: 'host-1', conflicts: [] })
    expect(actor.getSnapshot().value).toBe('PLAYING')
  })

  it('PLACE_DIGIT completing the board → COMPLETED, stats captured', () => {
    // Create a board with 80 given cells, leave [8][8] empty
    let board = createEmpty()
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!(r === 8 && c === 8)) {
          board = placeGiven(board, r, c, 1)
        }
      }
    }
    const actor = makeActor(board)
    actor.send({ type: 'BEGIN_SETUP', senderId: 'host-1' })
    actor.send({ type: 'START_GAME', senderId: 'host-1' })
    actor.send({ type: 'PLACE_DIGIT', row: 8, col: 8, value: 1, playerId: 'host-1', conflicts: [] })
    expect(actor.getSnapshot().value).toBe('COMPLETED')
    expect(actor.getSnapshot().context.stats).not.toBeNull()
  })

  it('RESET_BOARD in COMPLETED → SETUP, board cleared', () => {
    let board = createEmpty()
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!(r === 8 && c === 8)) {
          board = placeGiven(board, r, c, 1)
        }
      }
    }
    const actor = makeActor(board)
    actor.send({ type: 'BEGIN_SETUP', senderId: 'host-1' })
    actor.send({ type: 'START_GAME', senderId: 'host-1' })
    actor.send({ type: 'PLACE_DIGIT', row: 8, col: 8, value: 1, playerId: 'host-1', conflicts: [] })
    actor.send({ type: 'RESET_BOARD' })
    expect(actor.getSnapshot().value).toBe('SETUP')
    expect(actor.getSnapshot().context.board[0][0].value).toBeNull()
  })

  it('JOIN accepted in LOBBY without phase change', () => {
    const actor = makeActor()
    actor.send({ type: 'JOIN', player: player2 })
    expect(actor.getSnapshot().value).toBe('LOBBY')
    expect(actor.getSnapshot().context.players).toHaveLength(2)
  })

  it('LEAVE accepted in PLAYING without phase change', () => {
    const board = placeGiven(createEmpty(), 0, 0, 5)
    const actor = makeActor(board)
    actor.send({ type: 'JOIN', player: player2 })
    actor.send({ type: 'BEGIN_SETUP', senderId: 'host-1' })
    actor.send({ type: 'START_GAME', senderId: 'host-1' })
    actor.send({ type: 'LEAVE', playerId: 'player-2' })
    expect(actor.getSnapshot().value).toBe('PLAYING')
    expect(actor.getSnapshot().context.players).toHaveLength(1)
  })
})

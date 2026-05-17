import { describe, it, expect } from 'vitest'
import { Room } from './room'
import type { Player } from './player'
import { assignColour } from './player'

function makePlayer(id: string, index: number, isHost = false): Player {
  return {
    id,
    username: `User${id}`,
    avatar: '',
    colour: assignColour(index),
    socketId: `socket-${id}`,
    isHost,
  }
}

describe('Room', () => {
  it('first player to join is set as host', () => {
    const host = makePlayer('1', 0, true)
    const room = new Room('channel-1', host)
    expect(room.players[0].isHost).toBe(true)
  })

  it('second player gets different colour and isHost: false', () => {
    const host = makePlayer('1', 0, true)
    const player2 = makePlayer('2', 1, false)
    const room = new Room('channel-1', host)
    room.addPlayer(player2)
    expect(room.players[1].isHost).toBe(false)
    expect(room.players[1].colour).not.toBe(room.players[0].colour)
  })

  it('removePlayer of non-host — player removed, host unchanged', () => {
    const host = makePlayer('1', 0, true)
    const player2 = makePlayer('2', 1, false)
    const room = new Room('channel-1', host)
    room.addPlayer(player2)
    const result = room.removePlayer('socket-2')
    expect(result.empty).toBe(false)
    expect(result.newHostId).toBeUndefined()
    expect(room.players).toHaveLength(1)
    expect(room.players[0].isHost).toBe(true)
  })

  it('removePlayer of host — next player promoted, returned newHostId matches', () => {
    const host = makePlayer('1', 0, true)
    const player2 = makePlayer('2', 1, false)
    const room = new Room('channel-1', host)
    room.addPlayer(player2)
    const result = room.removePlayer('socket-1')
    expect(result.empty).toBe(false)
    expect(result.newHostId).toBe('2')
    expect(room.players[0].isHost).toBe(true)
  })

  it('removePlayer last player — returns { empty: true }', () => {
    const host = makePlayer('1', 0, true)
    const room = new Room('channel-1', host)
    const result = room.removePlayer('socket-1')
    expect(result.empty).toBe(true)
  })
})

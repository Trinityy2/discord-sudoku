import { describe, it, expect, beforeEach } from 'vitest'
import { RoomManager } from './roomManager'
import type { Player } from './player'

function makeHost(): Player {
  return {
    id: 'host-1',
    username: 'Host',
    avatar: '',
    colour: '#red',
    socketId: 'socket-host',
    isHost: true,
  }
}

describe('RoomManager', () => {
  let manager: RoomManager

  beforeEach(() => {
    manager = new RoomManager()
  })

  it('getOrCreate creates a new room for a new channelId', () => {
    const room = manager.getOrCreate('channel-1', makeHost())
    expect(room).toBeDefined()
    expect(room.channelId).toBe('channel-1')
  })

  it('getOrCreate returns the existing room for the same channelId', () => {
    const room1 = manager.getOrCreate('channel-1', makeHost())
    const room2 = manager.getOrCreate('channel-1', makeHost())
    expect(room1).toBe(room2)
  })

  it('destroy removes the room', () => {
    manager.getOrCreate('channel-1', makeHost())
    manager.destroy('channel-1')
    expect(manager.get('channel-1')).toBeUndefined()
  })

  it('get returns undefined for unknown channelId', () => {
    expect(manager.get('unknown')).toBeUndefined()
  })
})

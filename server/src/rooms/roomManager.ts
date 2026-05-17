import type { Player } from './player'
import { Room } from './room'

class RoomManager {
  private rooms = new Map<string, Room>()

  getOrCreate(channelId: string, hostPlayer: Player): Room {
    const existing = this.rooms.get(channelId)
    if (existing) return existing
    const room = new Room(channelId, hostPlayer)
    this.rooms.set(channelId, room)
    return room
  }

  get(channelId: string): Room | undefined {
    return this.rooms.get(channelId)
  }

  destroy(channelId: string): void {
    this.rooms.delete(channelId)
  }

  clearAll(): void {
    this.rooms.clear()
  }
}

export const roomManager = new RoomManager()
export { RoomManager }

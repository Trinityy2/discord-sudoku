import { createActor } from 'xstate'
import type { RoomState, BoardGrid, BoardMetadata } from 'shared'
import type { Player } from './player'
import { createEmpty } from '../board/board'
import { createRoomMachine } from '../machines/roomMachine'

export class Room {
  readonly channelId: string
  board: BoardGrid
  metadata: BoardMetadata
  players: Player[]
  private actor: ReturnType<typeof createActor>
  rulesetId: string

  constructor(channelId: string, hostPlayer: Player, rulesetId = 'base') {
    this.channelId = channelId
    this.board = createEmpty()
    this.metadata = {}
    this.players = [hostPlayer]
    this.rulesetId = rulesetId

    const machine = createRoomMachine({
      board: this.board,
      metadata: this.metadata,
      players: [hostPlayer as any],
      hostId: hostPlayer.id,
      rulesetId,
      startedAt: null,
      stats: null,
    })
    this.actor = createActor(machine)
    this.actor.start()
  }

  addPlayer(player: Player): void {
    this.players.push(player)
    this.actor.send({ type: 'JOIN', player: player as any })
  }

  removePlayer(socketId: string): { empty: boolean; newHostId?: string } {
    const playerIndex = this.players.findIndex(p => p.socketId === socketId)
    if (playerIndex === -1) return { empty: false }

    const player = this.players[playerIndex]
    const wasHost = player.isHost

    this.players.splice(playerIndex, 1)
    this.actor.send({ type: 'LEAVE', playerId: player.id })

    if (this.players.length === 0) {
      return { empty: true }
    }

    if (wasHost) {
      this.players[0].isHost = true
      return { empty: false, newHostId: this.players[0].id }
    }

    return { empty: false }
  }

  getPhase(): string {
    return this.actor.getSnapshot().value as string
  }

  getState(): RoomState {
    const snapshot = this.actor.getSnapshot()
    return {
      phase: snapshot.value as any,
      board: this.board,
      metadata: this.metadata,
      players: this.players as any,
      rulesetId: this.rulesetId,
      stats: snapshot.context.stats ?? undefined,
    }
  }

  sendToMachine(event: any): void {
    this.actor.send(event)
  }

  getActor() {
    return this.actor
  }
}

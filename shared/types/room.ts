import type { BoardGrid, BoardMetadata } from './board'

export type RoomPhase = 'LOBBY' | 'SETUP' | 'PLAYING' | 'COMPLETED'

export interface PlayerInfo {
  id: string
  username: string
  avatar: string
  colour: string
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

import type { Cell, CellCoord } from './board'
import type { RoomPhase, PlayerInfo, GameStats, RoomState } from './room'

export interface ClientToServerEvents {
  join_room: (data: { channelId: string; userId: string; username: string; avatar: string }) => void
  begin_setup: () => void
  place_given: (data: { row: number; col: number; value: number }) => void
  clear_given: (data: { row: number; col: number }) => void
  start_game: () => void
  set_ruleset: (data: { rulesetId: string }) => void
  place_digit: (data: { row: number; col: number; value: number }) => void
  clear_cell: (data: { row: number; col: number }) => void
  toggle_note: (data: { row: number; col: number; noteType: 'corner' | 'center'; value: number }) => void
  cursor_moved: (data: { row: number | null; col: number | null }) => void
}

export interface ServerToClientEvents {
  room_state: (state: RoomState) => void
  cell_updated: (data: { row: number; col: number; cell: Cell; conflicts: CellCoord[] }) => void
  player_joined: (player: PlayerInfo) => void
  player_left: (data: { playerId: string }) => void
  host_changed: (data: { newHostId: string }) => void
  phase_changed: (data: { phase: RoomPhase }) => void
  cursor_updated: (data: { playerId: string; row: number | null; col: number | null }) => void
  game_completed: (data: { stats: GameStats }) => void
}

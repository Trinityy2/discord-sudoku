import type { Server, Socket } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents, CellCoord } from 'shared'
import { roomManager as defaultRoomManager } from '../rooms/roomManager'
import type { RoomManager } from '../rooms/roomManager'
import { assignColour } from '../rooms/player'
import type { Player } from '../rooms/player'
import { registry } from '../rulesets/index'
import { placeGiven, clearGiven, placeDigit, clearCell, toggleNote, applyConflicts, isComplete } from '../board/board'
import { verifyDiscordToken } from '../auth/discordAuth'
import type { TokenVerifier } from '../auth/discordAuth'

type IoServer = Server<ClientToServerEvents, ServerToClientEvents>
type IoSocket = Socket<ClientToServerEvents, ServerToClientEvents>

export interface HandlerDeps {
  rm?: RoomManager
  verifyToken?: TokenVerifier
}

export function registerHandlers(io: IoServer, socket: IoSocket, deps: HandlerDeps = {}) {
  const rm = deps.rm ?? defaultRoomManager
  const verifyToken = deps.verifyToken ?? verifyDiscordToken

  // Map socketId -> channelId
  const socketChannelMap = new Map<string, string>()
  // Map socketId -> playerId
  const socketPlayerMap = new Map<string, string>()

  socket.on('join_room', async ({ channelId, accessToken }) => {
    let user: { id: string; username: string; avatar: string }
    try {
      user = await verifyToken(accessToken)
    } catch (err) {
      console.warn(`[join_room] token verification failed for socket ${socket.id}:`, (err as Error).message)
      socket.disconnect()
      return
    }

    const { id: userId, username, avatar } = user

    const existingRoom = rm.get(channelId)
    const isFirstPlayer = !existingRoom || existingRoom.players.length === 0
    const playerIndex = existingRoom ? existingRoom.players.length : 0
    const colour = assignColour(playerIndex)

    const player: Player = {
      id: userId,
      username,
      avatar,
      colour,
      socketId: socket.id,
      isHost: isFirstPlayer,
    }

    const room = rm.getOrCreate(channelId, player)

    if (!isFirstPlayer) {
      room.addPlayer(player)
    }

    socketChannelMap.set(socket.id, channelId)
    socketPlayerMap.set(socket.id, userId)

    socket.join(channelId)
    socket.emit('room_state', room.getState())
    socket.to(channelId).emit('player_joined', player as any)
  })

  socket.on('begin_setup', () => {
    const channelId = socketChannelMap.get(socket.id)
    if (!channelId) return
    const room = rm.get(channelId)
    if (!room) return

    const playerId = socketPlayerMap.get(socket.id)
    if (!playerId) return
    room.sendToMachine({ type: 'BEGIN_SETUP', senderId: playerId })

    const state = room.getState()
    if (state.phase === 'SETUP') {
      io.to(channelId).emit('phase_changed', { phase: 'SETUP' })
    }
  })

  socket.on('place_given', ({ row, col, value }) => {
    const channelId = socketChannelMap.get(socket.id)
    if (!channelId) return
    const room = rm.get(channelId)
    if (!room) return
    if (room.getState().phase !== 'SETUP') return

    const hostPlayer = room.players.find(p => p.socketId === socket.id)
    if (!hostPlayer?.isHost) return

    try {
      room.board = placeGiven(room.board, row, col, value)
      room.sendToMachine({ type: 'PLACE_GIVEN', row, col, value })
      const cell = room.board[row][col]
      io.to(channelId).emit('cell_updated', { row, col, cell, conflicts: [] })
    } catch (e) {
      // cell already given, ignore
    }
  })

  socket.on('clear_given', ({ row, col }) => {
    const channelId = socketChannelMap.get(socket.id)
    if (!channelId) return
    const room = rm.get(channelId)
    if (!room) return
    if (room.getState().phase !== 'SETUP') return

    const hostPlayer = room.players.find(p => p.socketId === socket.id)
    if (!hostPlayer?.isHost) return

    try {
      room.board = clearGiven(room.board, row, col)
      room.sendToMachine({ type: 'CLEAR_GIVEN', row, col })
      const cell = room.board[row][col]
      io.to(channelId).emit('cell_updated', { row, col, cell, conflicts: [] })
    } catch (e) {
      // cell not given, ignore
    }
  })

  socket.on('start_game', () => {
    const channelId = socketChannelMap.get(socket.id)
    if (!channelId) return
    const room = rm.get(channelId)
    if (!room) return

    const playerId = socketPlayerMap.get(socket.id)
    if (!playerId) return
    room.sendToMachine({ type: 'START_GAME', senderId: playerId })

    const state = room.getState()
    if (state.phase === 'PLAYING') {
      io.to(channelId).emit('phase_changed', { phase: 'PLAYING' })
    }
  })

  socket.on('set_ruleset', ({ rulesetId }) => {
    const channelId = socketChannelMap.get(socket.id)
    if (!channelId) return
    const room = rm.get(channelId)
    if (!room) return
    if (room.getState().phase !== 'SETUP') return

    const hostPlayer = room.players.find(p => p.socketId === socket.id)
    if (!hostPlayer?.isHost) return

    room.rulesetId = rulesetId
    io.to(channelId).emit('room_state', room.getState())
  })

  socket.on('place_digit', ({ row, col, value }) => {
    const channelId = socketChannelMap.get(socket.id)
    if (!channelId) return
    const room = rm.get(channelId)
    if (!room) return
    if (room.getState().phase !== 'PLAYING') return

    const playerId = socketPlayerMap.get(socket.id)
    if (!playerId) return

    room.board = placeDigit(room.board, row, col, value, playerId)

    // Recompute full-board conflicts after each placement
    const ruleset = registry.get(room.rulesetId)
    const allConflicts: CellCoord[] = []
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = room.board[r][c]
        if (cell.value !== null) {
          const cellConflicts = ruleset.validate(room.board, room.metadata, r, c, cell.value)
          allConflicts.push(...cellConflicts)
        }
      }
    }
    const seen = new Set<string>()
    const conflicts = allConflicts.filter(coord => {
      const key = `${coord.row},${coord.col}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    room.board = applyConflicts(room.board, conflicts)

    room.sendToMachine({ type: 'PLACE_DIGIT', row, col, value, playerId, conflicts })

    if (isComplete(room.board)) {
      const actor = room.getActor()
      const snapshot = actor.getSnapshot()
      const elapsedMs = snapshot.context.startedAt ? Date.now() - snapshot.context.startedAt : 0
      const contributions: { playerId: string; count: number }[] = []
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const cell = room.board[r][c]
          if (!cell.isGiven && cell.placedBy) {
            const existing = contributions.find(x => x.playerId === cell.placedBy)
            if (existing) {
              existing.count++
            } else {
              contributions.push({ playerId: cell.placedBy!, count: 1 })
            }
          }
        }
      }
      const stats = { elapsedMs, contributions }
      const finalCell = room.board[row][col]
      io.to(channelId).emit('cell_updated', { row, col, cell: finalCell, conflicts })
      io.to(channelId).emit('phase_changed', { phase: 'COMPLETED' })
      io.to(channelId).emit('game_completed', { stats })
    } else {
      const cell = room.board[row][col]
      io.to(channelId).emit('cell_updated', { row, col, cell, conflicts })
    }
  })

  socket.on('clear_cell', ({ row, col }) => {
    const channelId = socketChannelMap.get(socket.id)
    if (!channelId) return
    const room = rm.get(channelId)
    if (!room) return
    if (room.getState().phase !== 'PLAYING') return

    room.board = clearCell(room.board, row, col)
    const ruleset = registry.get(room.rulesetId)
    const allConflicts: CellCoord[] = []
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = room.board[r][c]
        if (cell.value !== null) {
          const cellConflicts = ruleset.validate(room.board, room.metadata, r, c, cell.value)
          allConflicts.push(...cellConflicts)
        }
      }
    }
    const seen = new Set<string>()
    const dedupedConflicts = allConflicts.filter(coord => {
      const key = `${coord.row},${coord.col}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    room.board = applyConflicts(room.board, dedupedConflicts)
    room.sendToMachine({ type: 'CLEAR_CELL', row, col, conflicts: dedupedConflicts })
    const cell = room.board[row][col]
    io.to(channelId).emit('cell_updated', { row, col, cell, conflicts: dedupedConflicts })
  })

  socket.on('toggle_note', ({ row, col, noteType, value }) => {
    const channelId = socketChannelMap.get(socket.id)
    if (!channelId) return
    const room = rm.get(channelId)
    if (!room) return
    if (room.getState().phase !== 'PLAYING') return

    room.board = toggleNote(room.board, row, col, noteType, value)
    room.sendToMachine({ type: 'TOGGLE_NOTE', row, col, noteType, value })
    const cell = room.board[row][col]
    io.to(channelId).emit('cell_updated', { row, col, cell, conflicts: [] })
  })

  socket.on('cursor_moved', ({ row, col }) => {
    const channelId = socketChannelMap.get(socket.id)
    if (!channelId) return
    const playerId = socketPlayerMap.get(socket.id)
    if (!playerId) return
    socket.to(channelId).emit('cursor_updated', { playerId, row, col })
  })

  socket.on('disconnect', () => {
    const channelId = socketChannelMap.get(socket.id)
    if (!channelId) return
    const room = rm.get(channelId)
    if (!room) return

    const result = room.removePlayer(socket.id)

    if (result.empty) {
      rm.destroy(channelId)
    } else {
      const playerId = socketPlayerMap.get(socket.id)
      if (playerId) {
        io.to(channelId).emit('player_left', { playerId })
        if (result.newHostId) {
          io.to(channelId).emit('host_changed', { newHostId: result.newHostId })
        }
      }
    }

    socketChannelMap.delete(socket.id)
    socketPlayerMap.delete(socket.id)
  })
}

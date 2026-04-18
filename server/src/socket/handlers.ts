import type { Server, Socket } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents, CellCoord } from 'shared'
import { roomManager } from '../rooms/roomManager'
import { assignColour } from '../rooms/player'
import type { Player } from '../rooms/player'
import { registry } from '../rulesets/index'
import { placeGiven, clearGiven, placeDigit, clearCell, toggleNote, applyConflicts, isComplete } from '../board/board'

type IoServer = Server<ClientToServerEvents, ServerToClientEvents>
type IoSocket = Socket<ClientToServerEvents, ServerToClientEvents>

// Map socketId -> channelId
const socketChannelMap = new Map<string, string>()
// Map socketId -> playerId
const socketPlayerMap = new Map<string, string>()

export function registerHandlers(io: IoServer, socket: IoSocket) {
  socket.on('join_room', ({ channelId, userId, username, avatar }) => {
    const existingRoom = roomManager.get(channelId)
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

    const room = roomManager.getOrCreate(channelId, player)

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
    const room = roomManager.get(channelId)
    if (!room) return

    const playerId = socketPlayerMap.get(socket.id)
    room.sendToMachine({ type: 'BEGIN_SETUP', senderId: playerId })

    const state = room.getState()
    if (state.phase === 'SETUP') {
      io.to(channelId).emit('phase_changed', { phase: 'SETUP' })
    }
  })

  socket.on('place_given', ({ row, col, value }) => {
    const channelId = socketChannelMap.get(socket.id)
    if (!channelId) return
    const room = roomManager.get(channelId)
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
    const room = roomManager.get(channelId)
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
    const room = roomManager.get(channelId)
    if (!room) return

    const playerId = socketPlayerMap.get(socket.id)
    room.sendToMachine({ type: 'START_GAME', senderId: playerId })

    const state = room.getState()
    if (state.phase === 'PLAYING') {
      io.to(channelId).emit('phase_changed', { phase: 'PLAYING' })
    }
  })

  socket.on('set_ruleset', ({ rulesetId }) => {
    const channelId = socketChannelMap.get(socket.id)
    if (!channelId) return
    const room = roomManager.get(channelId)
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
    const room = roomManager.get(channelId)
    if (!room) return
    if (room.getState().phase !== 'PLAYING') return

    const playerId = socketPlayerMap.get(socket.id)
    if (!playerId) return

    room.board = placeDigit(room.board, row, col, value, playerId)

    const ruleset = registry.get(room.rulesetId)
    const conflicts = ruleset.validate(room.board, room.metadata, row, col, value)
    room.board = applyConflicts(room.board, conflicts)

    const allFilled = room.board.every(row => row.every(cell => cell.value !== null))
    if (allFilled) {
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
      room.sendToMachine({ type: 'PLACE_DIGIT', row, col, value, playerId, conflicts })
      io.to(channelId).emit('game_completed', { stats })
    } else {
      const cell = room.board[row][col]
      io.to(channelId).emit('cell_updated', { row, col, cell, conflicts })
    }
  })

  socket.on('clear_cell', ({ row, col }) => {
    const channelId = socketChannelMap.get(socket.id)
    if (!channelId) return
    const room = roomManager.get(channelId)
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
    const cell = room.board[row][col]
    io.to(channelId).emit('cell_updated', { row, col, cell, conflicts: dedupedConflicts })
  })

  socket.on('toggle_note', ({ row, col, noteType, value }) => {
    const channelId = socketChannelMap.get(socket.id)
    if (!channelId) return
    const room = roomManager.get(channelId)
    if (!room) return
    if (room.getState().phase !== 'PLAYING') return

    room.board = toggleNote(room.board, row, col, noteType, value)
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
    const room = roomManager.get(channelId)
    if (!room) return

    const result = room.removePlayer(socket.id)

    if (result.empty) {
      roomManager.destroy(channelId)
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

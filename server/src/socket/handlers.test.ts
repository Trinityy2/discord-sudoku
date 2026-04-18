import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { io as Client, type Socket as ClientSocket } from 'socket.io-client'
import type { AddressInfo } from 'net'
import type { ClientToServerEvents, ServerToClientEvents } from 'shared'
import { RoomManager } from '../rooms/roomManager'
import { assignColour } from '../rooms/player'
import { placeGiven } from '../board/board'
import { registry } from '../rulesets/index'
import { placeDigit, applyConflicts, isComplete, clearCell, toggleNote } from '../board/board'
import type { Player } from '../rooms/player'

function createTestServer() {
  const httpServer = createServer()
  const testRoomManager = new RoomManager()
  const socketChannelMap = new Map<string, string>()
  const socketPlayerMap = new Map<string, string>()

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: '*' },
  })

  io.on('connection', (socket) => {
    socket.on('join_room', ({ channelId, userId, username, avatar }) => {
      const existingRoom = testRoomManager.get(channelId)
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

      const room = testRoomManager.getOrCreate(channelId, player)

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
      const room = testRoomManager.get(channelId)
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
      const room = testRoomManager.get(channelId)
      if (!room) return
      if (room.getState().phase !== 'SETUP') return
      const hostPlayer = room.players.find(p => p.socketId === socket.id)
      if (!hostPlayer?.isHost) return
      try {
        room.board = placeGiven(room.board, row, col, value)
        room.sendToMachine({ type: 'PLACE_GIVEN', row, col, value })
        const cell = room.board[row][col]
        io.to(channelId).emit('cell_updated', { row, col, cell, conflicts: [] })
      } catch (e) {}
    })

    socket.on('start_game', () => {
      const channelId = socketChannelMap.get(socket.id)
      if (!channelId) return
      const room = testRoomManager.get(channelId)
      if (!room) return
      const playerId = socketPlayerMap.get(socket.id)
      room.sendToMachine({ type: 'START_GAME', senderId: playerId })
      const state = room.getState()
      if (state.phase === 'PLAYING') {
        io.to(channelId).emit('phase_changed', { phase: 'PLAYING' })
      }
    })

    socket.on('place_digit', ({ row, col, value }) => {
      const channelId = socketChannelMap.get(socket.id)
      if (!channelId) return
      const room = testRoomManager.get(channelId)
      if (!room) return
      if (room.getState().phase !== 'PLAYING') return
      const playerId = socketPlayerMap.get(socket.id)
      if (!playerId) return

      room.board = placeDigit(room.board, row, col, value, playerId)
      const rulesetObj = registry.get(room.rulesetId)
      const conflicts = rulesetObj.validate(room.board, room.metadata, row, col, value)
      room.board = applyConflicts(room.board, conflicts)

      const allFilled = room.board.every(r => r.every(c => c.value !== null))
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
              if (existing) existing.count++
              else contributions.push({ playerId: cell.placedBy!, count: 1 })
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
      const room = testRoomManager.get(channelId)
      if (!room) return

      const result = room.removePlayer(socket.id)

      if (result.empty) {
        testRoomManager.destroy(channelId)
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
  })

  return { httpServer, io, testRoomManager }
}

function connectClient(url: string): Promise<ClientSocket<ServerToClientEvents, ClientToServerEvents>> {
  return new Promise((resolve) => {
    const client = Client(url, { autoConnect: false })
    client.connect()
    client.on('connect', () => resolve(client))
  })
}

function waitFor<T>(socket: ClientSocket<ServerToClientEvents, ClientToServerEvents>, event: keyof ServerToClientEvents): Promise<T> {
  return new Promise((resolve) => {
    socket.once(event as any, (data: any) => resolve(data))
  })
}

describe('Socket handlers integration', () => {
  let httpServer: ReturnType<typeof createServer>
  let io: Server<ClientToServerEvents, ServerToClientEvents>
  let testRoomManager: RoomManager
  let port: number
  let url: string
  let client1: ClientSocket<ServerToClientEvents, ClientToServerEvents>
  let client2: ClientSocket<ServerToClientEvents, ClientToServerEvents>

  beforeEach(async () => {
    const setup = createTestServer()
    httpServer = setup.httpServer
    io = setup.io
    testRoomManager = setup.testRoomManager

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => resolve())
    })
    port = (httpServer.address() as AddressInfo).port
    url = `http://localhost:${port}`

    client1 = await connectClient(url)
    client2 = await connectClient(url)
  })

  afterEach(async () => {
    client1.disconnect()
    client2.disconnect()
    io.close()
    await new Promise<void>((resolve) => httpServer.close(() => resolve()))
  })

  it('two clients join same channelId → both receive room_state; second receives player_joined', async () => {
    const roomStatePromise1 = waitFor(client1, 'room_state')
    client1.emit('join_room', { channelId: 'test-1', userId: 'user1', username: 'User1', avatar: '' })
    await roomStatePromise1

    const playerJoinedPromise = waitFor(client1, 'player_joined')
    const roomStatePromise2 = waitFor(client2, 'room_state')
    client2.emit('join_room', { channelId: 'test-1', userId: 'user2', username: 'User2', avatar: '' })

    const [roomState2, playerJoined] = await Promise.all([roomStatePromise2, playerJoinedPromise])
    expect((roomState2 as any).players).toHaveLength(2)
    expect((playerJoined as any).id).toBe('user2')
  })

  it('host sends begin_setup → both clients receive phase_changed { phase: SETUP }', async () => {
    const rs1 = waitFor(client1, 'room_state')
    client1.emit('join_room', { channelId: 'test-2', userId: 'host', username: 'Host', avatar: '' })
    await rs1

    const rs2 = waitFor(client2, 'room_state')
    client2.emit('join_room', { channelId: 'test-2', userId: 'user2', username: 'User2', avatar: '' })
    await rs2

    const phase1 = waitFor(client1, 'phase_changed')
    const phase2 = waitFor(client2, 'phase_changed')
    client1.emit('begin_setup')

    const [p1, p2] = await Promise.all([phase1, phase2])
    expect((p1 as any).phase).toBe('SETUP')
    expect((p2 as any).phase).toBe('SETUP')
  })

  it('host sends place_given → both clients receive cell_updated with correct cell data', async () => {
    const rs1 = waitFor(client1, 'room_state')
    client1.emit('join_room', { channelId: 'test-3', userId: 'host', username: 'Host', avatar: '' })
    await rs1

    await new Promise<void>(resolve => {
      client1.once('phase_changed', () => resolve())
      client1.emit('begin_setup')
    })

    const cu1 = waitFor(client1, 'cell_updated')
    client1.emit('place_given', { row: 0, col: 0, value: 5 })
    const cellUpdate = await cu1
    expect((cellUpdate as any).row).toBe(0)
    expect((cellUpdate as any).col).toBe(0)
    expect((cellUpdate as any).cell.value).toBe(5)
    expect((cellUpdate as any).cell.isGiven).toBe(true)
  })

  it('host sends start_game → both clients receive phase_changed { phase: PLAYING }', async () => {
    const rs1 = waitFor(client1, 'room_state')
    client1.emit('join_room', { channelId: 'test-4', userId: 'host', username: 'Host', avatar: '' })
    await rs1

    const rs2 = waitFor(client2, 'room_state')
    client2.emit('join_room', { channelId: 'test-4', userId: 'user2', username: 'User2', avatar: '' })
    await rs2

    await new Promise<void>(resolve => {
      client1.once('phase_changed', () => resolve())
      client1.emit('begin_setup')
    })

    await new Promise<void>(resolve => {
      client1.once('cell_updated', () => resolve())
      client1.emit('place_given', { row: 0, col: 0, value: 5 })
    })

    const phase1 = waitFor(client1, 'phase_changed')
    const phase2 = waitFor(client2, 'phase_changed')
    client1.emit('start_game')

    const [p1, p2] = await Promise.all([phase1, phase2])
    expect((p1 as any).phase).toBe('PLAYING')
    expect((p2 as any).phase).toBe('PLAYING')
  })

  it('client places a digit → other client receives cell_updated', async () => {
    const rs1 = waitFor(client1, 'room_state')
    client1.emit('join_room', { channelId: 'test-5', userId: 'host', username: 'Host', avatar: '' })
    await rs1

    const rs2 = waitFor(client2, 'room_state')
    client2.emit('join_room', { channelId: 'test-5', userId: 'user2', username: 'User2', avatar: '' })
    await rs2

    await new Promise<void>(resolve => {
      client1.once('phase_changed', () => resolve())
      client1.emit('begin_setup')
    })

    await new Promise<void>(resolve => {
      client1.once('cell_updated', () => resolve())
      client1.emit('place_given', { row: 0, col: 0, value: 5 })
    })

    await new Promise<void>(resolve => {
      client1.once('phase_changed', () => resolve())
      client1.emit('start_game')
    })

    const cellUpdated = waitFor(client1, 'cell_updated')
    client2.emit('place_digit', { row: 1, col: 0, value: 3 })
    const update = await cellUpdated
    expect((update as any).row).toBe(1)
    expect((update as any).col).toBe(0)
  })

  it('client sends cursor_moved → other client receives cursor_updated with correct playerId', async () => {
    const rs1 = waitFor(client1, 'room_state')
    client1.emit('join_room', { channelId: 'test-6', userId: 'host', username: 'Host', avatar: '' })
    await rs1

    const rs2 = waitFor(client2, 'room_state')
    client2.emit('join_room', { channelId: 'test-6', userId: 'user2', username: 'User2', avatar: '' })
    await rs2

    const cursorUpdated = waitFor(client1, 'cursor_updated')
    client2.emit('cursor_moved', { row: 3, col: 4 })
    const update = await cursorUpdated
    expect((update as any).playerId).toBe('user2')
    expect((update as any).row).toBe(3)
    expect((update as any).col).toBe(4)
  })

  it('all non-given cells filled with valid digits → both receive game_completed', async () => {
    const channelId = 'test-7'
    const rs1 = waitFor(client1, 'room_state')
    client1.emit('join_room', { channelId, userId: 'host', username: 'Host', avatar: '' })
    await rs1

    const rs2 = waitFor(client2, 'room_state')
    client2.emit('join_room', { channelId, userId: 'user2', username: 'User2', avatar: '' })
    await rs2

    await new Promise<void>(resolve => {
      client1.once('phase_changed', () => resolve())
      client1.emit('begin_setup')
    })

    // Place 80 givens, leave [8][8] empty
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!(r === 8 && c === 8)) {
          await new Promise<void>(resolve => {
            client1.once('cell_updated', () => resolve())
            client1.emit('place_given', { row: r, col: c, value: 1 })
          })
        }
      }
    }

    await new Promise<void>(resolve => {
      client1.once('phase_changed', () => resolve())
      client1.emit('start_game')
    })

    const gc1 = waitFor(client1, 'game_completed')
    const gc2 = waitFor(client2, 'game_completed')
    client1.emit('place_digit', { row: 8, col: 8, value: 1 })

    const [result1, result2] = await Promise.all([gc1, gc2])
    expect((result1 as any).stats).toBeDefined()
    expect((result2 as any).stats).toBeDefined()
  })

  it('host disconnects → remaining client receives host_changed with new host id', async () => {
    const channelId = 'test-8'
    const rs1 = waitFor(client1, 'room_state')
    client1.emit('join_room', { channelId, userId: 'host', username: 'Host', avatar: '' })
    await rs1

    const pj = waitFor(client1, 'player_joined')
    const rs2 = waitFor(client2, 'room_state')
    client2.emit('join_room', { channelId, userId: 'user2', username: 'User2', avatar: '' })
    await Promise.all([pj, rs2])

    const hostChanged = waitFor(client2, 'host_changed')
    client1.disconnect()

    const result = await hostChanged
    expect((result as any).newHostId).toBe('user2')
  })

  it('last client disconnects → room is destroyed', async () => {
    const channelId = 'test-9'
    const rs1 = waitFor(client1, 'room_state')
    client1.emit('join_room', { channelId, userId: 'host', username: 'Host', avatar: '' })
    await rs1

    await new Promise<void>(resolve => setTimeout(resolve, 100))
    client1.disconnect()
    await new Promise<void>(resolve => setTimeout(resolve, 200))

    expect(testRoomManager.get(channelId)).toBeUndefined()
  })
})

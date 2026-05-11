import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { io as Client, type Socket as ClientSocket } from 'socket.io-client'
import type { AddressInfo } from 'net'
import type { ClientToServerEvents, ServerToClientEvents } from 'shared'
import { RoomManager } from '../rooms/roomManager'
import { registerHandlers } from './handlers'
import type { TokenVerifier } from '../auth/discordAuth'

// Mock token verifier — maps "token:<id>:<username>" → DiscordUser
const mockVerify: TokenVerifier = async (token) => {
  const [, id, username] = token.split(':')
  if (!id || !username) throw new Error('Invalid mock token')
  return { id, username, avatar: '' }
}

function makeToken(id: string, username: string) {
  return `token:${id}:${username}`
}

function createTestServer() {
  const httpServer = createServer()
  const testRoomManager = new RoomManager()

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: '*' },
  })

  io.on('connection', (socket) =>
    registerHandlers(io, socket, { rm: testRoomManager, verifyToken: mockVerify })
  )

  return { httpServer, io, testRoomManager }
}

function connectClient(url: string): Promise<ClientSocket<ServerToClientEvents, ClientToServerEvents>> {
  return new Promise((resolve) => {
    const client = Client(url, { autoConnect: false })
    client.connect()
    client.on('connect', () => resolve(client))
  })
}

function waitFor<T>(
  socket: ClientSocket<ServerToClientEvents, ClientToServerEvents>,
  event: keyof ServerToClientEvents,
): Promise<T> {
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
    client1.emit('join_room', { channelId: 'test-1', accessToken: makeToken('user1', 'User1') })
    await roomStatePromise1

    const playerJoinedPromise = waitFor(client1, 'player_joined')
    const roomStatePromise2 = waitFor(client2, 'room_state')
    client2.emit('join_room', { channelId: 'test-1', accessToken: makeToken('user2', 'User2') })

    const [roomState2, playerJoined] = await Promise.all([roomStatePromise2, playerJoinedPromise])
    expect((roomState2 as any).players).toHaveLength(2)
    expect((playerJoined as any).id).toBe('user2')
  })

  it('host sends begin_setup → both clients receive phase_changed { phase: SETUP }', async () => {
    const rs1 = waitFor(client1, 'room_state')
    client1.emit('join_room', { channelId: 'test-2', accessToken: makeToken('host', 'Host') })
    await rs1

    const rs2 = waitFor(client2, 'room_state')
    client2.emit('join_room', { channelId: 'test-2', accessToken: makeToken('user2', 'User2') })
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
    client1.emit('join_room', { channelId: 'test-3', accessToken: makeToken('host', 'Host') })
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
    client1.emit('join_room', { channelId: 'test-4', accessToken: makeToken('host', 'Host') })
    await rs1

    const rs2 = waitFor(client2, 'room_state')
    client2.emit('join_room', { channelId: 'test-4', accessToken: makeToken('user2', 'User2') })
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
    client1.emit('join_room', { channelId: 'test-5', accessToken: makeToken('host', 'Host') })
    await rs1

    const rs2 = waitFor(client2, 'room_state')
    client2.emit('join_room', { channelId: 'test-5', accessToken: makeToken('user2', 'User2') })
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
    client1.emit('join_room', { channelId: 'test-6', accessToken: makeToken('host', 'Host') })
    await rs1

    const rs2 = waitFor(client2, 'room_state')
    client2.emit('join_room', { channelId: 'test-6', accessToken: makeToken('user2', 'User2') })
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
    client1.emit('join_room', { channelId, accessToken: makeToken('host', 'Host') })
    await rs1

    const rs2 = waitFor(client2, 'room_state')
    client2.emit('join_room', { channelId, accessToken: makeToken('user2', 'User2') })
    await rs2

    await new Promise<void>(resolve => {
      client1.once('phase_changed', () => resolve())
      client1.emit('begin_setup')
    })

    // Valid Sudoku solution grid — place 80 as givens, leave [8][8] (value 9) for the player
    const solution = [
      [5, 3, 4, 6, 7, 8, 9, 1, 2],
      [6, 7, 2, 1, 9, 5, 3, 4, 8],
      [1, 9, 8, 3, 4, 2, 5, 6, 7],
      [8, 5, 9, 7, 6, 1, 4, 2, 3],
      [4, 2, 6, 8, 5, 3, 7, 9, 1],
      [7, 1, 3, 9, 2, 4, 8, 5, 6],
      [9, 6, 1, 5, 3, 7, 2, 8, 4],
      [2, 8, 7, 4, 1, 9, 6, 3, 5],
      [3, 4, 5, 2, 8, 6, 1, 7, 9],
    ]
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!(r === 8 && c === 8)) {
          await new Promise<void>(resolve => {
            client1.once('cell_updated', () => resolve())
            client1.emit('place_given', { row: r, col: c, value: solution[r][c] })
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
    // Place the final cell: value 9 at [8][8]
    client1.emit('place_digit', { row: 8, col: 8, value: 9 })

    const [result1, result2] = await Promise.all([gc1, gc2])
    expect((result1 as any).stats).toBeDefined()
    expect((result2 as any).stats).toBeDefined()
  }, 15000)

  it('host disconnects → remaining client receives host_changed with new host id', async () => {
    const channelId = 'test-8'
    const rs1 = waitFor(client1, 'room_state')
    client1.emit('join_room', { channelId, accessToken: makeToken('host', 'Host') })
    await rs1

    const pj = waitFor(client1, 'player_joined')
    const rs2 = waitFor(client2, 'room_state')
    client2.emit('join_room', { channelId, accessToken: makeToken('user2', 'User2') })
    await Promise.all([pj, rs2])

    const hostChanged = waitFor(client2, 'host_changed')
    client1.disconnect()

    const result = await hostChanged
    expect((result as any).newHostId).toBe('user2')
  })

  it('last client disconnects → room is destroyed', async () => {
    const channelId = 'test-9'
    const rs1 = waitFor(client1, 'room_state')
    client1.emit('join_room', { channelId, accessToken: makeToken('host', 'Host') })
    await rs1

    await new Promise<void>(resolve => setTimeout(resolve, 100))
    client1.disconnect()
    await new Promise<void>(resolve => setTimeout(resolve, 200))

    expect(testRoomManager.get(channelId)).toBeUndefined()
  })
})


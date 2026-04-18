import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from 'shared'
import { config } from './config'
import { registerHandlers } from './socket/handlers'

const app = express()
const httpServer = createServer(app)
export const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: config.clientUrl },
})

app.get('/health', (_req, res) => res.json({ ok: true }))

io.on('connection', (socket) => registerHandlers(io, socket))

export { httpServer }

if (require.main === module) {
  httpServer.listen(config.port, () =>
    console.log(`Server running on port ${config.port}`)
  )
}

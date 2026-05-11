import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from 'shared'
import { config } from './config'
import { registerHandlers } from './socket/handlers'

const app = express()
app.use(express.json())

const httpServer = createServer(app)
export const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: config.clientUrl },
})

app.get('/health', (_req, res) => res.json({ ok: true }))

app.post('/api/token', async (req, res) => {
  const { code } = req.body as { code?: string }
  if (!code) {
    res.status(400).json({ error: 'Missing code' })
    return
  }
  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.discord.clientId,
      client_secret: config.discord.clientSecret,
      grant_type: 'authorization_code',
      code,
    }),
  })
  if (!tokenRes.ok) {
    res.status(401).json({ error: 'Token exchange failed' })
    return
  }
  const { access_token } = (await tokenRes.json()) as { access_token: string }
  res.json({ access_token })
})

io.on('connection', (socket) => registerHandlers(io, socket))

export { httpServer }

if (require.main === module) {
  httpServer.listen(config.port, () =>
    console.log(`Server running on port ${config.port}`)
  )
}

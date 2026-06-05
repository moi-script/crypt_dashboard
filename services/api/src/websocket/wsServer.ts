import { WebSocketServer, WebSocket } from 'ws'
import { redisSubscriber } from './redisSubscriber'
import jwt from 'jsonwebtoken'
import type { Server } from 'http'
import type { IncomingMessage } from 'http'

interface AuthedSocket extends WebSocket {
  userId?: string
}

function getUserIdFromRequest(req: IncomingMessage): string | null {
  try {
    const url = new URL(req.url ?? '', 'http://localhost')
    const token = url.searchParams.get('token')
    if (!token) return null
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { sub: string }
    return payload.sub
  } catch {
    return null
  }
}

const clients = new Set<AuthedSocket>()

export function initWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' })

  wss.on('connection', (ws: AuthedSocket, req: IncomingMessage) => {
    const userId = getUserIdFromRequest(req)
    if (!userId) {
      ws.close(4001, 'Unauthorized')
      return
    }

    ws.userId = userId
    clients.add(ws)
    ws.on('close', () => clients.delete(ws))
  })

  // ✅ Channels as array — puts the callback in the correct typed position
  redisSubscriber.subscribe(
    ['prices', 'alerts'],
    (message: string, channel: string) => {
      const data = JSON.parse(message)

      clients.forEach((ws) => {
        if (ws.readyState !== WebSocket.OPEN) return

        if (channel === 'prices') {
          ws.send(JSON.stringify({ channel, data }))
          return
        }

        if (channel === 'alerts' && data.userId === ws.userId) {
          ws.send(JSON.stringify({ channel, data }))
        }
      })
    },
  )
}
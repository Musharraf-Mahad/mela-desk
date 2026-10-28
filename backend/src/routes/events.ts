import { Router } from 'express'
import { subscribeToTicketEvents } from '../lib/ticketEvents.js'
import { authenticate } from '../middleware/authenticate.js'

const eventsRouter = Router()

eventsRouter.get('/', authenticate, (req, res) => {
  res.status(200)
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.flushHeaders()
  res.write(': connected\n\n')

  const unsubscribe = subscribeToTicketEvents(req.user!.id, res)
  const heartbeat = setInterval(() => {
    res.write(': keep-alive\n\n')
  }, 25_000)
  const expiresIn = Math.max(0, req.user!.sessionExpiresAt.getTime() - Date.now())
  const expireSession = setTimeout(() => {
    res.end()
  }, expiresIn)

  res.on('close', () => {
    clearInterval(heartbeat)
    clearTimeout(expireSession)
    unsubscribe()
  })
})

export default eventsRouter

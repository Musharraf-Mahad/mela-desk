import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('../src/lib/prisma.js', () => ({ prisma: prismaMock }))

import app from '../src/app.js'
import { publishTicketEvent } from '../src/lib/ticketEvents.js'
import { SESSION_COOKIE_NAME } from '../src/lib/session.js'

describe('ticket event stream', () => {
  let server: Server
  let baseUrl: string

  beforeEach(async () => {
    vi.resetAllMocks()
    server = app.listen(0)
    await once(server, 'listening')
    const address = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  })

  it('requires an authenticated session to open the event stream', async () => {
    const response = await fetch(`${baseUrl}/api/events`)

    expect(response.status).toBe(401)
    expect(response.headers.get('content-type')).not.toContain('text/event-stream')
  })

  it('streams ticket updates only to the addressed signed-in user', async () => {
    const user = { id: 'agent-1', role: 'agent' }
    prismaMock.session.findFirst.mockResolvedValue({
      user,
      expiresAt: new Date(Date.now() + 60_000),
    })

    const response = await fetch(`${baseUrl}/api/events`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=agent-token` },
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/event-stream')
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()

    try {
      const connected = await reader.read()
      expect(decoder.decode(connected.value)).toContain(': connected')

      publishTicketEvent(['another-agent'], {
        type: 'ticket.assigned',
        ticketId: 'ticket-1',
      })
      publishTicketEvent([user.id], {
        type: 'ticket.assigned',
        ticketId: 'ticket-1',
      })

      let timeout: ReturnType<typeof setTimeout> | undefined
      const update = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('Timed out waiting for ticket update')), 1000)
        }),
      ]).finally(() => {
        if (timeout) clearTimeout(timeout)
      })
      const payload = decoder.decode(update.value)
      expect(payload).toContain('event: ticket')
      expect(payload).toContain('"type":"ticket.assigned"')
      expect(payload).toContain('"ticketId":"ticket-1"')
    } finally {
      await reader.cancel()
    }
  })
})

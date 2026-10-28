import 'dotenv/config'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { randomUUID } from 'node:crypto'
import app from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'
import { SESSION_COOKIE_NAME } from '../src/lib/session.js'

type ApiResponse<T> = {
  success: boolean
  data?: T
  message?: string
}

const email = `db-smoke-${randomUUID()}@example.invalid`
const password = `SmokeTest-${randomUUID()}`
let server: Server | undefined

async function request<T>(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<{ response: Response; payload: ApiResponse<T> }> {
  const response = await fetch(`${baseUrl}${path}`, init)
  const payload = (await response.json()) as ApiResponse<T>
  return { response, payload }
}

function assertStatus<T>(
  response: Response,
  payload: ApiResponse<T>,
  expectedStatus: number,
  operation: string,
): void {
  if (response.status !== expectedStatus) {
    throw new Error(
      `${operation} returned HTTP ${response.status}: ${payload.message ?? 'unexpected response'}`,
    )
  }
}

async function run(): Promise<void> {
  let userId: string | undefined

  try {
    await prisma.$queryRaw`SELECT 1`

    server = app.listen(0)
    await once(server, 'listening')
    const address = server.address() as AddressInfo
    const baseUrl = `http://127.0.0.1:${address.port}`

    const registration = await request<{ user: { id: string; email: string } }>(
      baseUrl,
      '/api/auth/register',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Database Smoke Test',
          email,
          password,
        }),
      },
    )
    assertStatus(registration.response, registration.payload, 201, 'Registration')
    assert.equal(registration.payload.success, true)
    if (!registration.payload.data?.user.id) {
      throw new Error('Registration response did not include a user ID.')
    }
    userId = registration.payload.data.user.id

    const login = await request<{ user: { id: string; email: string } }>(
      baseUrl,
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      },
    )
    assertStatus(login.response, login.payload, 200, 'Login')
    assert.equal(login.payload.data?.user.id, userId)
    const sessionCookie = login.response.headers.get('set-cookie')?.split(';', 1)[0]
    if (!sessionCookie?.startsWith(`${SESSION_COOKIE_NAME}=`)) {
      throw new Error('Login response did not include the expected session cookie.')
    }

    const authenticatedHeaders = { cookie: sessionCookie }
    const currentUser = await request<{ user: { id: string } }>(
      baseUrl,
      '/api/auth/me',
      { headers: authenticatedHeaders },
    )
    assertStatus(currentUser.response, currentUser.payload, 200, 'Current-user lookup')
    assert.equal(currentUser.payload.data?.user.id, userId)

    const updatedProfile = await request<{ user: { name: string } }>(
      baseUrl,
      '/api/auth/profile',
      {
        method: 'PATCH',
        headers: { ...authenticatedHeaders, 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Database Smoke Test Updated' }),
      },
    )
    assertStatus(updatedProfile.response, updatedProfile.payload, 200, 'Profile update')
    assert.equal(updatedProfile.payload.data?.user.name, 'Database Smoke Test Updated')

    const marker = randomUUID()
    const ticket = await request<{ ticket: { id: string; subject: string } }>(
      baseUrl,
      '/api/tickets',
      {
        method: 'POST',
        headers: { ...authenticatedHeaders, 'content-type': 'application/json' },
        body: JSON.stringify({
          subject: `Database smoke ${marker}`,
          description: `Database-backed ticket workflow ${marker}`,
          category: 'technical',
          priority: 'normal',
        }),
      },
    )
    assertStatus(ticket.response, ticket.payload, 201, 'Ticket creation')
    const ticketId = ticket.payload.data?.ticket.id
    if (!ticketId) {
      throw new Error('Ticket response did not include a ticket ID.')
    }

    const ticketList = await request<{ tickets: Array<{ id: string }> }>(
      baseUrl,
      `/api/tickets?search=${encodeURIComponent(marker)}`,
      { headers: authenticatedHeaders },
    )
    assertStatus(ticketList.response, ticketList.payload, 200, 'Ticket listing')
    assert.ok(ticketList.payload.data?.tickets.some(({ id }) => id === ticketId))

    const ticketDetails = await request<{
      ticket: { id: string; comments: Array<{ isInternal?: boolean }> }
    }>(baseUrl, `/api/tickets/${ticketId}`, { headers: authenticatedHeaders })
    assertStatus(ticketDetails.response, ticketDetails.payload, 200, 'Ticket lookup')
    assert.equal(ticketDetails.payload.data?.ticket.id, ticketId)
    assert.deepEqual(ticketDetails.payload.data?.ticket.comments, [])

    const comment = await request<{ comment: { id: string; body: string } }>(
      baseUrl,
      `/api/tickets/${ticketId}/comments`,
      {
        method: 'POST',
        headers: { ...authenticatedHeaders, 'content-type': 'application/json' },
        body: JSON.stringify({ body: 'Database-backed smoke test comment' }),
      },
    )
    assertStatus(comment.response, comment.payload, 201, 'Comment creation')
    assert.equal(comment.payload.data?.comment.body, 'Database-backed smoke test comment')

    const logout = await request<never>(baseUrl, '/api/auth/logout', {
      method: 'POST',
      headers: authenticatedHeaders,
    })
    assertStatus(logout.response, logout.payload, 200, 'Logout')

    const revokedSession = await request(baseUrl, '/api/auth/me', {
      headers: authenticatedHeaders,
    })
    assert.equal(revokedSession.response.status, 401)

    console.log('Database smoke test passed: registration, session, profile, tickets, comments, and logout.')
  } finally {
    if (server?.listening) {
      await new Promise<void>((resolve, reject) => {
        server!.close((error) => (error ? reject(error) : resolve()))
      })
    }

    if (userId) {
      const smokeUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          tickets: { select: { id: true } },
        },
      })

      if (smokeUser) {
        const ticketIds = smokeUser.tickets.map(({ id }) => id)
        await prisma.auditLog.deleteMany({
          where: {
            OR: [
              { userId: smokeUser.id },
              ...(ticketIds.length > 0 ? [{ ticketId: { in: ticketIds } }] : []),
            ],
          },
        })
        await prisma.user.delete({ where: { id: smokeUser.id } })
      }
    }

    await prisma.$disconnect()
  }
}

run().catch((error: unknown) => {
  console.error('Database smoke test failed.')
  if (error instanceof Error) {
    console.error(error.message)
  }
  process.exitCode = 1
})

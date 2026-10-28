import type { Response } from 'express'

export type TicketEvent = {
  type: string
  ticketId: string
  [key: string]: unknown
}

const connections = new Map<string, Set<Response>>()

export function subscribeToTicketEvents(userId: string, response: Response): () => void {
  const userConnections = connections.get(userId) ?? new Set<Response>()
  userConnections.add(response)
  connections.set(userId, userConnections)

  return () => {
    userConnections.delete(response)
    if (userConnections.size === 0) connections.delete(userId)
  }
}

export function publishTicketEvent(userIds: readonly string[], event: TicketEvent): void {
  const message = `event: ticket\ndata: ${JSON.stringify(event)}\n\n`
  const recipients = new Set(userIds.filter(Boolean))

  for (const userId of recipients) {
    for (const response of connections.get(userId) ?? []) {
      if (response.writableEnded || response.destroyed) {
        connections.get(userId)?.delete(response)
        continue
      }

      response.write(message)
    }

    if (connections.get(userId)?.size === 0) connections.delete(userId)
  }
}

export function closeTicketEventConnections(userId: string): void {
  for (const response of connections.get(userId) ?? []) {
    response.end()
  }
  connections.delete(userId)
}

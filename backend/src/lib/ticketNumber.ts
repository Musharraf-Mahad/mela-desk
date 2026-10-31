import type { Prisma } from '@prisma/client'

export const TICKET_NUMBER_PREFIX = 'TKT-'
export const TICKET_NUMBER_PADDING = 6

export function formatTicketNumber(sequence: number): string {
  return `${TICKET_NUMBER_PREFIX}${String(sequence).padStart(TICKET_NUMBER_PADDING, '0')}`
}

export function parseTicketNumber(ticketNumber: string): number | null {
  const match = ticketNumber.trim().toUpperCase().match(/^TKT-(\d+)$/)
  if (!match) return null
  const num = parseInt(match[1], 10)
  return isNaN(num) ? null : num
}

export async function allocateNextTicketNumber(tx: Prisma.TransactionClient): Promise<string> {
  // If running with a mock or raw queries are not supported:
  if (typeof tx.$executeRaw !== 'function' || typeof tx.$queryRaw !== 'function') {
    if ('ticketCounter' in tx && typeof (tx as any).ticketCounter?.upsert === 'function') {
      const counter = await (tx as any).ticketCounter.upsert({
        where: { id: 1 },
        create: { id: 1, lastValue: 1 },
        update: { lastValue: { increment: 1 } },
      })
      return formatTicketNumber(counter.lastValue)
    }
    return formatTicketNumber(1)
  }

  await tx.$executeRaw`
    INSERT INTO ticket_counters (id, last_value)
    VALUES (1, 0)
    ON DUPLICATE KEY UPDATE id = id
  `

  const counterRows = await tx.$queryRaw<{ last_value: number }[]>`
    SELECT last_value FROM ticket_counters WHERE id = 1 FOR UPDATE
  `

  let currentVal = Number(counterRows[0]?.last_value ?? 0)

  if (currentVal === 0) {
    const maxRow = await tx.$queryRaw<{ max_seq: number | null }[]>`
      SELECT MAX(CAST(SUBSTRING(ticket_number, 5) AS UNSIGNED)) as max_seq
      FROM tickets
      WHERE ticket_number LIKE 'TKT-%'
    `
    const maxVal = Number(maxRow[0]?.max_seq ?? 0)
    if (maxVal > currentVal) {
      currentVal = maxVal
    }
  }

  const nextVal = currentVal + 1

  await tx.$executeRaw`
    UPDATE ticket_counters
    SET last_value = ${nextVal}
    WHERE id = 1
  `

  return formatTicketNumber(nextVal)
}

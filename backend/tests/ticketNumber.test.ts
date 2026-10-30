import { describe, expect, it, vi } from 'vitest'
import {
  formatTicketNumber,
  parseTicketNumber,
  allocateNextTicketNumber,
} from '../src/lib/ticketNumber.js'

describe('ticketNumber library', () => {
  it('formats ticket sequence into TKT-000000 format', () => {
    expect(formatTicketNumber(1)).toBe('TKT-000001')
    expect(formatTicketNumber(42)).toBe('TKT-000042')
    expect(formatTicketNumber(123456)).toBe('TKT-123456')
    expect(formatTicketNumber(1234567)).toBe('TKT-1234567')
  })

  it('parses formatted ticket numbers correctly', () => {
    expect(parseTicketNumber('TKT-000001')).toBe(1)
    expect(parseTicketNumber('tkt-000042')).toBe(42)
    expect(parseTicketNumber(' TKT-123456 ')).toBe(123456)
    expect(parseTicketNumber('INVALID')).toBeNull()
    expect(parseTicketNumber('TKT-')).toBeNull()
    expect(parseTicketNumber('TKT-ABC')).toBeNull()
  })

  it('allocates next ticket number using mock/fallback transaction', async () => {
    const mockTx = {
      ticketCounter: {
        upsert: vi.fn().mockResolvedValue({ id: 1, lastValue: 5 }),
      },
    } as any

    const allocated = await allocateNextTicketNumber(mockTx)
    expect(allocated).toBe('TKT-000005')
    expect(mockTx.ticketCounter.upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      create: { id: 1, lastValue: 1 },
      update: { lastValue: { increment: 1 } },
    })
  })

  it('allocates next ticket number using raw SQL with row-locking query', async () => {
    const mockTx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      $queryRaw: vi.fn().mockResolvedValue([{ last_value: 12 }]),
    } as any

    const allocated = await allocateNextTicketNumber(mockTx)
    expect(allocated).toBe('TKT-000013')
    expect(mockTx.$executeRaw).toHaveBeenCalledTimes(2)
    expect(mockTx.$queryRaw).toHaveBeenCalledTimes(1)
  })
})

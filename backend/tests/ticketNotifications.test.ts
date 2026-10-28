import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock, createTransportMock, sendMailMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findMany: vi.fn(),
    },
  },
  createTransportMock: vi.fn(),
  sendMailMock: vi.fn(),
}))

vi.mock('../src/lib/prisma.js', () => ({ prisma: prismaMock }))
vi.mock('nodemailer', () => ({
  default: { createTransport: createTransportMock },
}))

describe('ticket email notifications', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.resetModules()
    delete process.env.SMTP_HOST
    delete process.env.SMTP_PORT
    delete process.env.SMTP_SECURE
    delete process.env.SMTP_USER
    delete process.env.SMTP_PASSWORD
    delete process.env.SMTP_FROM
    createTransportMock.mockReturnValue({ sendMail: sendMailMock })
    sendMailMock.mockResolvedValue({ messageId: 'message-1' })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.SMTP_HOST
    delete process.env.SMTP_PORT
    delete process.env.SMTP_SECURE
    delete process.env.SMTP_USER
    delete process.env.SMTP_PASSWORD
    delete process.env.SMTP_FROM
  })

  it('sends email to unique active users using SMTP settings', async () => {
    process.env.SMTP_HOST = 'smtp.example.com'
    process.env.SMTP_PORT = '587'
    process.env.SMTP_USER = 'smtp-user'
    process.env.SMTP_PASSWORD = 'smtp-password'
    process.env.SMTP_FROM = 'support@example.com'
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'agent-1', email: 'agent@example.com' },
      { id: 'customer-1', email: 'customer@example.com' },
    ])
    const { sendTicketEmailNotification } = await import('../src/lib/ticketNotifications.js')

    await sendTicketEmailNotification({
      userIds: ['agent-1', 'customer-1', 'agent-1'],
      subject: 'Ticket assigned',
      text: 'A ticket was assigned.',
    })

    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['agent-1', 'customer-1'] }, isActive: true },
      select: { id: true, email: true },
    })
    expect(createTransportMock).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: { user: 'smtp-user', pass: 'smtp-password' },
    })
    expect(sendMailMock).toHaveBeenCalledTimes(2)
    expect(sendMailMock).toHaveBeenCalledWith({
      from: 'support@example.com',
      to: 'agent@example.com',
      subject: 'Ticket assigned',
      text: 'A ticket was assigned.',
    })
  })

  it('does not query recipients when SMTP has not been configured', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { sendTicketEmailNotification } = await import('../src/lib/ticketNotifications.js')

    await sendTicketEmailNotification({
      userIds: ['agent-1'],
      subject: 'Ticket assigned',
      text: 'A ticket was assigned.',
    })

    expect(warning).toHaveBeenCalledWith(
      'Ticket email notifications are disabled; configure SMTP_HOST and SMTP_FROM.',
    )
    expect(prismaMock.user.findMany).not.toHaveBeenCalled()
    expect(sendMailMock).not.toHaveBeenCalled()
  })
})

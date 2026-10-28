import nodemailer, { type Transporter } from 'nodemailer'
import { z } from 'zod'
import { prisma } from './prisma.js'

const smtpSettingsSchema = z.object({
  host: z.string().trim().min(1),
  port: z.coerce.number().int().min(1).max(65535).default(587),
  secure: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  user: z.string().trim().optional(),
  password: z.string().optional(),
  from: z.string().trim().email(),
})

type EmailNotification = {
  userIds: readonly string[]
  subject: string
  text: string
}

let transporter: Transporter | undefined
let missingSmtpWarningWritten = false

function getTransporter(): { transport: Transporter; from: string } | null {
  const parsed = smtpSettingsSchema.safeParse({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE ?? 'false',
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM,
  })

  if (!parsed.success) {
    if (
      !process.env.SMTP_HOST?.trim() &&
      !process.env.SMTP_FROM?.trim() &&
      !process.env.SMTP_USER?.trim() &&
      !process.env.SMTP_PASSWORD
    ) {
      if (!missingSmtpWarningWritten) {
        console.warn('Ticket email notifications are disabled; configure SMTP_HOST and SMTP_FROM.')
        missingSmtpWarningWritten = true
      }
      return null
    }

    throw new Error('SMTP configuration is incomplete or invalid; check SMTP_HOST, SMTP_PORT, SMTP_SECURE, and SMTP_FROM.')
  }

  if (Boolean(parsed.data.user) !== Boolean(parsed.data.password)) {
    throw new Error('SMTP_USER and SMTP_PASSWORD must both be configured or both be empty.')
  }

  transporter ??= nodemailer.createTransport({
    host: parsed.data.host,
    port: parsed.data.port,
    secure: parsed.data.secure,
    ...(parsed.data.user
      ? { auth: { user: parsed.data.user, pass: parsed.data.password } }
      : {}),
  })

  return { transport: transporter, from: parsed.data.from }
}

export async function sendTicketEmailNotification({
  userIds,
  subject,
  text,
}: EmailNotification): Promise<void> {
  const recipientIds = [...new Set(userIds)]
  if (recipientIds.length === 0) return

  try {
    const mailer = getTransporter()
    if (!mailer) return

    const recipients = await prisma.user.findMany({
      where: { id: { in: recipientIds }, isActive: true },
      select: { id: true, email: true },
    })

    const results = await Promise.allSettled(
      recipients.map(({ email }) =>
        mailer.transport.sendMail({
          from: mailer.from,
          to: email,
          subject,
          text,
        }),
      ),
    )

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(
          `Ticket email notification failed for user ${recipients[index].id}:`,
          result.reason instanceof Error ? result.reason.message : 'Unknown mail delivery error',
        )
      }
    })
  } catch (error) {
    console.error(
      'Ticket email notification could not be sent:',
      error instanceof Error ? error.message : 'Unknown notification error',
    )
  }
}

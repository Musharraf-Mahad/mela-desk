import { Router } from 'express'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { z } from 'zod'
import { TicketCategory, TicketPriority, TicketStatus, UserRole } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { allocateNextTicketNumber } from '../lib/ticketNumber.js'
import { publishTicketEvent } from '../lib/ticketEvents.js'
import { sendDirectEmail } from '../lib/ticketNotifications.js'
import { createRateLimiter } from '../lib/rateLimit.js'
import {
  parseMultipartFormData,
  saveAttachmentFile,
  MAX_ATTACHMENTS_PER_TICKET,
  type StoredAttachment,
} from '../lib/fileStorage.js'

const publicRouter = Router()

// Rate limiter for public tracking queries to prevent brute-force token enumeration
const trackingLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 20,
  message: 'Too many tracking attempts. Please wait a minute and try again.',
})

// Schema for JSON guest ticket creation
const publicTicketSchema = z.object({
  guestName: z.string().trim().min(1, 'Name is required').max(120),
  guestEmail: z.string().trim().email('Invalid email address').max(255),
  subject: z.string().trim().min(1, 'Subject is required').max(255),
  description: z.string().trim().min(1, 'Description is required').max(10_000),
  category: z.nativeEnum(TicketCategory),
})

const trackTicketSchema = z.object({
  ticketNumber: z.string().trim().min(1, 'Ticket number is required').max(32),
  trackingToken: z.string().trim().min(1, 'Tracking token is required').max(128),
})

const guestReplySchema = z.object({
  ticketNumber: z.string().trim().min(1).max(32),
  trackingToken: z.string().trim().min(1).max(128),
  body: z.string().trim().min(1, 'Reply message cannot be empty').max(10_000),
})

/**
 * POST /api/public/tickets
 * Public customer ticket submission (supports both JSON and multipart/form-data with attachments)
 */
publicRouter.post('/tickets', async (req, res) => {
  const isMultipart = req.headers['content-type']?.includes('multipart/form-data')

  let parsedBody: z.infer<typeof publicTicketSchema>
  let uploadedFiles: Array<{ originalFilename: string; buffer: Buffer; size: number; declaredMimeType: string }> = []

  if (isMultipart) {
    try {
      const { fields, files } = await parseMultipartFormData(req)
      const parsed = publicTicketSchema.safeParse(fields)
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: 'Invalid submission data',
          errors: parsed.error.issues.map(({ path, message }) => ({
            field: path.join('.'),
            message,
          })),
        })
        return
      }
      parsedBody = parsed.data
      uploadedFiles = files
    } catch (err: unknown) {
      res.status(400).json({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to parse form data',
      })
      return
    }
  } else {
    const parsed = publicTicketSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid submission data',
        errors: parsed.error.issues.map(({ path, message }) => ({
          field: path.join('.'),
          message,
        })),
      })
      return
    }
    parsedBody = parsed.data
  }

  // Validate number of attachments
  if (uploadedFiles.length > MAX_ATTACHMENTS_PER_TICKET) {
    res.status(400).json({
      success: false,
      message: `You can upload at most ${MAX_ATTACHMENTS_PER_TICKET} attachments per ticket.`,
    })
    return
  }

  // Process and save files first
  const savedAttachments: StoredAttachment[] = []
  for (const file of uploadedFiles) {
    const saveResult = await saveAttachmentFile(file)
    if (!saveResult.success) {
      // Clean up already saved files
      for (const a of savedAttachments) {
        try {
          if (fs.existsSync(a.storagePath)) fs.unlinkSync(a.storagePath)
        } catch {}
      }
      res.status(422).json({
        success: false,
        message: saveResult.error,
      })
      return
    }
    savedAttachments.push(saveResult.attachment)
  }

  try {
    // Generate secure random tracking token
    const trackingToken = crypto.randomBytes(24).toString('hex')
    const trackingTokenHash = crypto.createHash('sha256').update(trackingToken).digest('hex')

    const ticket = await prisma.$transaction(async (tx) => {
      const ticketNumber = await allocateNextTicketNumber(tx)

      const createdTicket = await tx.ticket.create({
        data: {
          ticketNumber,
          guestName: parsedBody.guestName,
          guestEmail: parsedBody.guestEmail,
          trackingTokenHash,
          customerId: null,
          subject: parsedBody.subject,
          description: parsedBody.description,
          category: parsedBody.category,
          priority: TicketPriority.normal, // safe default for unauthenticated tickets
          status: TicketStatus.open,
          ...(savedAttachments.length > 0
            ? {
                attachments: {
                  createMany: {
                    data: savedAttachments.map((a) => ({
                      originalFilename: a.originalFilename,
                      storedFilename: a.storedFilename,
                      mimeType: a.mimeType,
                      fileSize: a.fileSize,
                      storagePath: a.storagePath,
                    })),
                  },
                },
              }
            : {}),
        },
        select: {
          id: true,
          ticketNumber: true,
          subject: true,
          category: true,
          priority: true,
          status: true,
          createdAt: true,
          attachments: {
            select: {
              id: true,
              originalFilename: true,
              mimeType: true,
              fileSize: true,
            },
          },
        },
      })

      // Audit log (never log raw tracking token)
      await tx.auditLog.create({
        data: {
          ticketId: createdTicket.id,
          action: 'ticket.guest_created',
          details: JSON.stringify({
            ticketNumber,
            category: parsedBody.category,
            priority: TicketPriority.normal,
            attachmentsCount: savedAttachments.length,
          }),
        },
      })

      return createdTicket
    })

    // Publish event to support staff
    try {
      const agents = await prisma.user.findMany({
        where: { role: { in: [UserRole.agent, UserRole.department_head] }, isActive: true },
        select: { id: true },
      })
      publishTicketEvent(
        agents.map(({ id }) => id),
        {
          type: 'ticket.created',
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          priority: ticket.priority,
        }
      )
    } catch (e) {
      console.error('Failed to notify staff of guest ticket:', e)
    }

    // Send confirmation email to guest
    void sendDirectEmail({
      to: parsedBody.guestEmail,
      subject: `[${ticket.ticketNumber}] Support Ticket Confirmation: ${ticket.subject}`,
      text: `Hello ${parsedBody.guestName},\n\n` +
        `Thank you for reaching out to MelaDesk Support. We have received your request and assigned it ticket number ${ticket.ticketNumber}.\n\n` +
        `You can securely track the progress of your ticket anytime using this link or credentials:\n` +
        `Ticket Number: ${ticket.ticketNumber}\n` +
        `Tracking Token: ${trackingToken}\n\n` +
        `Our support team will review your inquiry shortly.\n\n` +
        `Best regards,\nMelaDesk Support Team`,
    })

    res.status(201).json({
      success: true,
      message: 'Support ticket submitted successfully.',
      data: {
        ticketNumber: ticket.ticketNumber,
        trackingToken, // Provided once on creation for user to save
        subject: ticket.subject,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        createdAt: ticket.createdAt,
        attachments: ticket.attachments,
      },
    })
  } catch (error) {
    console.error('Public ticket creation failed:', error)
    // Clean up files on error
    for (const a of savedAttachments) {
      try {
        if (fs.existsSync(a.storagePath)) fs.unlinkSync(a.storagePath)
      } catch {}
    }
    res.status(500).json({
      success: false,
      message: 'Unable to submit ticket. Please try again.',
    })
  }
})

/**
 * POST /api/public/tickets/track
 * Secure ticket tracking endpoint using ticket number + tracking credential
 */
publicRouter.post('/tickets/track', trackingLimiter, async (req, res) => {
  const parsed = trackTicketSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: 'Please provide both ticket number and tracking token.',
    })
    return
  }

  const { ticketNumber, trackingToken } = parsed.data
  const trackingTokenHash = crypto.createHash('sha256').update(trackingToken).digest('hex')

  try {
    const ticket = await prisma.ticket.findFirst({
      where: {
        ticketNumber: ticketNumber.toUpperCase(),
        trackingTokenHash,
      },
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        description: true,
        category: true,
        priority: true,
        status: true,
        guestName: true,
        guestEmail: true,
        createdAt: true,
        updatedAt: true,
        // Only return public customer-facing comments
        comments: {
          where: { isInternal: false },
          select: {
            id: true,
            body: true,
            createdAt: true,
            author: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        attachments: {
          select: {
            id: true,
            originalFilename: true,
            mimeType: true,
            fileSize: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!ticket) {
      res.status(404).json({
        success: false,
        message: 'No ticket matches the provided ticket number and tracking credential.',
      })
      return
    }

    res.status(200).json({
      success: true,
      data: {
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        description: ticket.description,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        guestName: ticket.guestName,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        comments: ticket.comments.map((c) => ({
          id: c.id,
          body: c.body,
          createdAt: c.createdAt,
          authorName: c.author?.name || 'Support Staff',
          isStaff: c.author?.role !== UserRole.customer,
        })),
        attachments: ticket.attachments,
      },
    })
  } catch (error) {
    console.error('Public ticket tracking failed:', error)
    res.status(500).json({
      success: false,
      message: 'Unable to track ticket. Please try again.',
    })
  }
})

/**
 * GET /api/public/tickets/:ticketNumber/attachments/:attachmentId
 * Secure download for guest attachments verified by tracking token
 */
publicRouter.get('/tickets/:ticketNumber/attachments/:attachmentId', trackingLimiter, async (req, res) => {
  const ticketNumber = Array.isArray(req.params.ticketNumber) ? req.params.ticketNumber[0] : req.params.ticketNumber
  const attachmentId = Array.isArray(req.params.attachmentId) ? req.params.attachmentId[0] : req.params.attachmentId
  const trackingToken = (req.query.token as string) || (req.headers['x-tracking-token'] as string)

  if (!trackingToken) {
    res.status(401).json({ success: false, message: 'Tracking token required to download attachments.' })
    return
  }

  const trackingTokenHash = crypto.createHash('sha256').update(trackingToken).digest('hex')

  try {
    const ticket = await prisma.ticket.findFirst({
      where: {
        ticketNumber: ticketNumber.toUpperCase(),
        trackingTokenHash,
      },
      select: {
        id: true,
        attachments: {
          where: { id: attachmentId },
          select: {
            id: true,
            originalFilename: true,
            mimeType: true,
            storagePath: true,
          },
        },
      },
    })

    if (!ticket || ticket.attachments.length === 0) {
      res.status(404).json({ success: false, message: 'Attachment not found.' })
      return
    }

    const attachment = ticket.attachments[0]
    if (!fs.existsSync(attachment.storagePath)) {
      res.status(404).json({ success: false, message: 'Attachment file missing from storage.' })
      return
    }

    // Set secure download headers
    res.setHeader('Content-Type', attachment.mimeType)
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.originalFilename)}"`)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate')

    fs.createReadStream(attachment.storagePath).pipe(res)
  } catch (error) {
    console.error('Public attachment download failed:', error)
    res.status(500).json({ success: false, message: 'Unable to download attachment.' })
  }
})

export { publicRouter }

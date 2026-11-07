import { Router } from 'express'
import fs from 'node:fs'
import { UserRole } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { authenticate } from '../middleware/authenticate.js'
import {
  parseMultipartFormData,
  saveAttachmentFile,
  removeAttachmentFile,
  MAX_ATTACHMENTS_PER_TICKET,
} from '../lib/fileStorage.js'

const attachmentsRouter = Router()

/**
 * Helper to resolve user department ID for department heads
 */
async function resolveUserDepartmentId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { departmentId: true, headedDepartment: { select: { id: true } } },
  })
  return user?.headedDepartment?.id ?? user?.departmentId ?? null
}

/**
 * Checks whether the authenticated user has view access to the given ticket
 */
async function checkTicketAccess(
  ticketId: string,
  user: { id: string; role: UserRole; departmentId?: string | null }
): Promise<{ allowed: boolean; ticket?: any }> {
  const ticket = await prisma.ticket.findFirst({
    where: {
      ...(ticketId.toUpperCase().startsWith('TKT-')
        ? { ticketNumber: ticketId.toUpperCase() }
        : { id: ticketId }),
    },
    select: {
      id: true,
      ticketNumber: true,
      customerId: true,
      assigneeId: true,
      departmentId: true,
      status: true,
    },
  })

  if (!ticket) return { allowed: false }

  // Admin and Head have organization-wide view access
  if (user.role === UserRole.admin || user.role === UserRole.head) {
    return { allowed: true, ticket }
  }

  // Customer can only view their own tickets
  if (user.role === UserRole.customer) {
    return { allowed: ticket.customerId === user.id, ticket }
  }

  // Department Head can only access tickets in their department
  if (user.role === UserRole.department_head) {
    const headDeptId = await resolveUserDepartmentId(user.id)
    return { allowed: Boolean(headDeptId && ticket.departmentId === headDeptId), ticket }
  }

  // Support Agent can access if assigned to them or unassigned
  if (user.role === UserRole.agent) {
    const isAssignedToMe = ticket.assigneeId === user.id
    const isUnassigned = ticket.assigneeId === null
    return { allowed: isAssignedToMe || isUnassigned, ticket }
  }

  return { allowed: false, ticket }
}

/**
 * GET /api/tickets/:ticketId/attachments
 * List attachments on a ticket
 */
attachmentsRouter.get('/:ticketId/attachments', authenticate, async (req, res) => {
  const ticketId = Array.isArray(req.params.ticketId) ? req.params.ticketId[0] : req.params.ticketId
  const { allowed, ticket } = await checkTicketAccess(ticketId, req.user!)

  if (!allowed || !ticket) {
    res.status(404).json({ success: false, message: 'Ticket not found or access denied.' })
    return
  }

  try {
    const attachments = await prisma.attachment.findMany({
      where: { ticketId: ticket.id },
      select: {
        id: true,
        originalFilename: true,
        mimeType: true,
        fileSize: true,
        createdAt: true,
        uploadedBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    res.status(200).json({ success: true, data: { attachments } })
  } catch (error) {
    console.error('Failed to list attachments:', error)
    res.status(500).json({ success: false, message: 'Unable to retrieve attachments.' })
  }
})

/**
 * POST /api/tickets/:ticketId/attachments
 * Upload one or more attachments to an existing ticket
 */
attachmentsRouter.post('/:ticketId/attachments', authenticate, async (req, res) => {
  const ticketId = Array.isArray(req.params.ticketId) ? req.params.ticketId[0] : req.params.ticketId
  const { allowed, ticket } = await checkTicketAccess(ticketId, req.user!)

  if (!allowed || !ticket) {
    res.status(404).json({ success: false, message: 'Ticket not found or access denied.' })
    return
  }

  // Check if ticket is closed
  if (ticket.status === 'closed' && req.user!.role !== UserRole.admin) {
    res.status(400).json({ success: false, message: 'Cannot upload attachments to a closed ticket.' })
    return
  }

  // Head is strictly read-only
  if (req.user!.role === UserRole.head) {
    res.status(403).json({ success: false, message: 'Head role has read-only permissions.' })
    return
  }

  try {
    const { files } = await parseMultipartFormData(req)
    if (files.length === 0) {
      res.status(400).json({ success: false, message: 'No files provided for upload.' })
      return
    }

    const currentCount = await prisma.attachment.count({ where: { ticketId: ticket.id } })
    if (currentCount + files.length > MAX_ATTACHMENTS_PER_TICKET) {
      res.status(400).json({
        success: false,
        message: `Total attachments cannot exceed ${MAX_ATTACHMENTS_PER_TICKET}. Current count: ${currentCount}.`,
      })
      return
    }

    const savedRecords = []
    for (const file of files) {
      const saveRes = await saveAttachmentFile(file)
      if (!saveRes.success) {
        res.status(422).json({ success: false, message: saveRes.error })
        return
      }

      const created = await prisma.attachment.create({
        data: {
          ticketId: ticket.id,
          originalFilename: saveRes.attachment.originalFilename,
          storedFilename: saveRes.attachment.storedFilename,
          mimeType: saveRes.attachment.mimeType,
          fileSize: saveRes.attachment.fileSize,
          storagePath: saveRes.attachment.storagePath,
          uploadedById: req.user!.id,
        },
        select: {
          id: true,
          originalFilename: true,
          mimeType: true,
          fileSize: true,
          createdAt: true,
          uploadedBy: {
            select: { id: true, name: true },
          },
        },
      })

      await prisma.auditLog.create({
        data: {
          ticketId: ticket.id,
          userId: req.user!.id,
          action: 'attachment.uploaded',
          details: JSON.stringify({
            attachmentId: created.id,
            originalFilename: created.originalFilename,
            fileSize: created.fileSize,
            mimeType: created.mimeType,
          }),
        },
      })

      savedRecords.push(created)
    }

    res.status(201).json({
      success: true,
      message: 'Attachment uploaded successfully.',
      data: { attachments: savedRecords },
    })
  } catch (error) {
    console.error('Attachment upload failed:', error)
    res.status(500).json({ success: false, message: 'Attachment upload failed.' })
  }
})

/**
 * GET /api/tickets/:ticketId/attachments/:attachmentId
 * Secure download endpoint for authenticated users
 */
attachmentsRouter.get('/:ticketId/attachments/:attachmentId', authenticate, async (req, res) => {
  const ticketId = Array.isArray(req.params.ticketId) ? req.params.ticketId[0] : req.params.ticketId
  const attachmentId = Array.isArray(req.params.attachmentId) ? req.params.attachmentId[0] : req.params.attachmentId
  const { allowed, ticket } = await checkTicketAccess(ticketId, req.user!)

  if (!allowed || !ticket) {
    res.status(404).json({ success: false, message: 'Ticket not found or access denied.' })
    return
  }

  try {
    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, ticketId: ticket.id },
    })

    if (!attachment || !fs.existsSync(attachment.storagePath)) {
      res.status(404).json({ success: false, message: 'Attachment file not found.' })
      return
    }

    // Audit download
    await prisma.auditLog.create({
      data: {
        ticketId: ticket.id,
        userId: req.user!.id,
        action: 'attachment.downloaded',
        details: JSON.stringify({
          attachmentId: attachment.id,
          originalFilename: attachment.originalFilename,
        }),
      },
    })

    // Set secure download headers
    res.setHeader('Content-Type', attachment.mimeType)
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.originalFilename)}"`)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate')

    fs.createReadStream(attachment.storagePath).pipe(res)
  } catch (error) {
    console.error('Attachment download failed:', error)
    res.status(500).json({ success: false, message: 'Unable to download attachment.' })
  }
})

/**
 * DELETE /api/tickets/:ticketId/attachments/:attachmentId
 * Delete an attachment (Admin or original uploader if ticket not closed)
 */
attachmentsRouter.delete('/:ticketId/attachments/:attachmentId', authenticate, async (req, res) => {
  const ticketId = Array.isArray(req.params.ticketId) ? req.params.ticketId[0] : req.params.ticketId
  const attachmentId = Array.isArray(req.params.attachmentId) ? req.params.attachmentId[0] : req.params.attachmentId
  const { allowed, ticket } = await checkTicketAccess(ticketId, req.user!)

  if (!allowed || !ticket) {
    res.status(404).json({ success: false, message: 'Ticket not found or access denied.' })
    return
  }

  try {
    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, ticketId: ticket.id },
    })

    if (!attachment) {
      res.status(404).json({ success: false, message: 'Attachment not found.' })
      return
    }

    // Permission check for deletion:
    // Admin can delete any attachment. Original uploader can delete if ticket is not closed.
    const isAdmin = req.user!.role === UserRole.admin
    const isUploader = attachment.uploadedById === req.user!.id && ticket.status !== 'closed'

    if (!isAdmin && !isUploader) {
      res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this attachment.',
      })
      return
    }

    // Delete record from DB and file from storage
    await prisma.attachment.delete({ where: { id: attachment.id } })
    await removeAttachmentFile(attachment.storagePath)

    await prisma.auditLog.create({
      data: {
        ticketId: ticket.id,
        userId: req.user!.id,
        action: 'attachment.deleted',
        details: JSON.stringify({
          attachmentId: attachment.id,
          originalFilename: attachment.originalFilename,
        }),
      },
    })

    res.status(200).json({ success: true, message: 'Attachment deleted successfully.' })
  } catch (error) {
    console.error('Attachment deletion failed:', error)
    res.status(500).json({ success: false, message: 'Unable to delete attachment.' })
  }
})

export { attachmentsRouter }

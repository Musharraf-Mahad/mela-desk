import type { UserRole } from '@prisma/client'
import type { RequestHandler } from 'express'
import { prisma } from '../lib/prisma.js'
import { clearSessionCookie, hashSessionToken, readSessionCookie } from '../lib/session.js'

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        role: UserRole
      }
    }
  }
}

export const authenticate: RequestHandler = async (req, res, next) => {
  const token = readSessionCookie(req)

  if (!token) {
    res.status(401).json({ success: false, message: 'Authentication required' })
    return
  }

  try {
    const session = await prisma.session.findFirst({
      where: {
        tokenHash: hashSessionToken(token),
        expiresAt: { gt: new Date() },
        user: { isActive: true },
      },
      select: {
        user: {
          select: {
            id: true,
            role: true,
          },
        },
      },
    })

    if (!session) {
      clearSessionCookie(res)
      res.status(401).json({ success: false, message: 'Authentication required' })
      return
    }

    req.user = session.user
    next()
  } catch (error) {
    console.error('Authentication session lookup failed:', error)
    res.status(500).json({
      success: false,
      message: 'Unable to verify authentication',
    })
  }
}

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' })
      return
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' })
      return
    }

    next()
  }
}

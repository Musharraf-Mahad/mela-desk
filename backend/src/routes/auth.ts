import { Prisma } from '@prisma/client'
import argon2 from 'argon2'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authenticate } from '../middleware/authenticate.js'
import {
  clearSessionCookie,
  createSessionToken,
  hashSessionToken,
  readSessionCookie,
  SESSION_DURATION_SECONDS,
  setSessionCookie,
} from '../lib/session.js'

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
} as const

const registerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255).transform((email) => email.toLowerCase()),
  password: z.string().min(12).max(128),
})

const loginSchema = z.object({
  email: z.string().trim().email().max(255).transform((email) => email.toLowerCase()),
  password: z.string().min(12).max(128),
})

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(12).max(128),
  })
  .refine(({ currentPassword, newPassword }) => currentPassword !== newPassword, {
    path: ['newPassword'],
    message: 'New password must be different from the current password',
  })

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(120),
})

const authRouter = Router()

authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: 'Invalid registration details',
      errors: parsed.error.issues.map(({ path, message }) => ({
        field: path.join('.'),
        message,
      })),
    })
    return
  }

  try {
    const passwordHash = await argon2.hash(parsed.data.password, {
      type: argon2.argon2id,
    })

    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
      },
      select: publicUserSelect,
    })

    res.status(201).json({
      success: true,
      data: { user },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(409).json({
        success: false,
        message: 'An account with this email already exists',
      })
      return
    }

    console.error('Customer registration failed:', error)
    res.status(500).json({
      success: false,
      message: 'Unable to create account',
    })
  }
})

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: 'Invalid login details',
      errors: parsed.error.issues.map(({ path, message }) => ({
        field: path.join('.'),
        message,
      })),
    })
    return
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: {
        ...publicUserSelect,
        passwordHash: true,
        isActive: true,
      },
    })

    if (
      !user ||
      !user.isActive ||
      !(await argon2.verify(user.passwordHash, parsed.data.password))
    ) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      })
      return
    }

    const token = createSessionToken()
    const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000)
    await prisma.session.create({
      data: {
        tokenHash: hashSessionToken(token),
        userId: user.id,
        expiresAt,
      },
    })
    setSessionCookie(res, token)

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
        },
      },
    })
  } catch (error) {
    console.error('Customer login failed:', error)
    res.status(500).json({
      success: false,
      message: 'Unable to log in',
    })
  }
})

authRouter.get('/me', async (req, res) => {
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
        user: { select: publicUserSelect },
      },
    })

    if (!session) {
      clearSessionCookie(res)
      res.status(401).json({ success: false, message: 'Authentication required' })
      return
    }

    res.status(200).json({
      success: true,
      data: { user: session.user },
    })
  } catch (error) {
    console.error('Session lookup failed:', error)
    res.status(500).json({
      success: false,
      message: 'Unable to verify session',
    })
  }
})

authRouter.patch('/profile', authenticate, async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: 'Invalid profile details',
      errors: parsed.error.issues.map(({ path, message }) => ({
        field: path.join('.'),
        message,
      })),
    })
    return
  }

  try {
    const user = await prisma.$transaction(async (transaction) => {
      const updatedUser = await transaction.user.update({
        where: { id: req.user!.id },
        data: { name: parsed.data.name },
        select: publicUserSelect,
      })

      await transaction.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'user.profile_updated',
        },
      })

      return updatedUser
    })

    res.status(200).json({
      success: true,
      data: { user },
    })
  } catch (error) {
    console.error('Profile update failed:', error)
    res.status(500).json({
      success: false,
      message: 'Unable to update profile',
    })
  }
})

authRouter.post('/change-password', authenticate, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: 'Invalid password change details',
      errors: parsed.error.issues.map(({ path, message }) => ({
        field: path.join('.'),
        message,
      })),
    })
    return
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { passwordHash: true, isActive: true },
    })

    if (
      !user ||
      !user.isActive ||
      !(await argon2.verify(user.passwordHash, parsed.data.currentPassword))
    ) {
      res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      })
      return
    }

    const passwordHash = await argon2.hash(parsed.data.newPassword, {
      type: argon2.argon2id,
    })

    await prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: req.user!.id },
        data: { passwordHash },
      })
      await transaction.session.deleteMany({
        where: { userId: req.user!.id },
      })
      await transaction.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'user.password_changed',
        },
      })
    })

    clearSessionCookie(res)
    res.status(200).json({
      success: true,
      message: 'Password changed. Please log in again.',
    })
  } catch (error) {
    console.error('Password change failed:', error)
    res.status(500).json({
      success: false,
      message: 'Unable to change password',
    })
  }
})

authRouter.post('/logout', async (req, res) => {
  const token = readSessionCookie(req)

  try {
    if (token) {
      await prisma.session.deleteMany({
        where: { tokenHash: hashSessionToken(token) },
      })
    }

    clearSessionCookie(res)
    res.status(200).json({ success: true, message: 'Logged out successfully' })
  } catch (error) {
    console.error('Session revocation failed:', error)
    res.status(500).json({
      success: false,
      message: 'Unable to log out',
    })
  }
})

export default authRouter

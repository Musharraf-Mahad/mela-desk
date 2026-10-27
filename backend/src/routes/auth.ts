import { Prisma } from '@prisma/client'
import argon2 from 'argon2'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

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
      },
    })

    if (!user || !(await argon2.verify(user.passwordHash, parsed.data.password))) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      })
      return
    }

    const { passwordHash: _passwordHash, ...safeUser } = user

    res.status(200).json({
      success: true,
      data: {
        user: safeUser,
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

export default authRouter

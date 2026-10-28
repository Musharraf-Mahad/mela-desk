import 'dotenv/config'
import { Prisma, UserRole } from '@prisma/client'
import argon2 from 'argon2'
import { z } from 'zod'
import { prisma } from '../src/lib/prisma.js'

const bootstrapSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255).transform((email) => email.toLowerCase()),
  password: z.string().min(12).max(128),
})

async function createInitialAdmin(): Promise<void> {
  const parsed = bootstrapSchema.safeParse({
    name: process.env.BOOTSTRAP_ADMIN_NAME,
    email: process.env.BOOTSTRAP_ADMIN_EMAIL,
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
  })

  delete process.env.BOOTSTRAP_ADMIN_NAME
  delete process.env.BOOTSTRAP_ADMIN_EMAIL
  delete process.env.BOOTSTRAP_ADMIN_PASSWORD

  if (!parsed.success) {
    throw new Error(
      'Provide a valid BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL, and BOOTSTRAP_ADMIN_PASSWORD (12-128 characters).',
    )
  }

  const passwordHash = await argon2.hash(parsed.data.password, {
    type: argon2.argon2id,
  })

  await prisma.$transaction(
    async (transaction) => {
      const existingAdmin = await transaction.user.findFirst({
        where: { role: UserRole.admin },
        select: { id: true },
      })

      if (existingAdmin) {
        throw new Error('An admin account already exists; initial admin creation is disabled.')
      }

      const admin = await transaction.user.create({
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          passwordHash,
          role: UserRole.admin,
        },
        select: { id: true },
      })

      await transaction.auditLog.create({
        data: {
          userId: admin.id,
          action: 'user.admin_bootstrapped',
        },
      })
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )

  console.log('Initial admin created successfully. Sign in through POST /api/auth/login.')
}

createInitialAdmin()
  .catch((error: unknown) => {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      console.error('An account with that email already exists.')
    } else if (error instanceof Error) {
      console.error(error.message)
    } else {
      console.error('Initial admin creation failed.')
    }

    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

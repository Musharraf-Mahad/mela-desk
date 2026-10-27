import express from 'express'
import cors from 'cors'
import { getCorsOptions } from './lib/cors.js'
import { prisma } from './lib/prisma.js'
import authRouter from './routes/auth.js'
import ticketsRouter from './routes/tickets.js'
import usersRouter from './routes/users.js'

const app = express()

app.use(cors(getCorsOptions()))
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/tickets', ticketsRouter)
app.use('/api/users', usersRouter)

app.get('/', (_req, res) => {
  res.json({
    message: 'Welcome to the Mela Desk API',
    status: 'running',
  })
})

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`

    res.status(200).json({
      success: true,
      message: 'Mela Desk API is healthy',
      dependencies: {
        database: 'connected',
      },
    })
  } catch (error) {
    console.error('Mela Desk database health check failed:', error)
    res.status(503).json({
      success: false,
      message: 'Mela Desk API database is unavailable',
      dependencies: {
        database: 'disconnected',
      },
    })
  }
})

export default app
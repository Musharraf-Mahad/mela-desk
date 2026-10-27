import express from 'express'
import cors from 'cors'

const app = express()

app.use(cors())
app.use(express.json())

app.get('/', (_req, res) => {
  res.json({
    message: 'Welcome to the Mela Desk API',
    status: 'running',
  })
})

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Mela Desk API is healthy',
  })
})

export default app
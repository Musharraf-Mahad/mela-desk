import type { Request, Response, NextFunction } from 'express'

interface RateLimitOptions {
  windowMs: number
  max: number
  message?: string
}

export function createRateLimiter(options: RateLimitOptions) {
  const { windowMs, max, message = 'Too many requests, please try again later.' } = options
  const hits = new Map<string, number[]>()

  // Cleanup old records periodically
  const cleanupInterval = Math.max(windowMs, 60_000)
  const timer = setInterval(() => {
    const now = Date.now()
    for (const [ip, timestamps] of hits.entries()) {
      const active = timestamps.filter((t) => now - t < windowMs)
      if (active.length === 0) hits.delete(ip)
      else hits.set(ip, active)
    }
  }, cleanupInterval)
  if (timer.unref) timer.unref()

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown'
    const now = Date.now()
    const timestamps = (hits.get(ip) || []).filter((t) => now - t < windowMs)

    if (timestamps.length >= max) {
      const oldest = timestamps[0]
      const retryAfterSec = Math.ceil((windowMs - (now - oldest)) / 1000)
      res.setHeader('Retry-After', String(Math.max(1, retryAfterSec)))
      res.status(429).json({
        success: false,
        message,
        retryAfter: Math.max(1, retryAfterSec),
      })
      return
    }

    timestamps.push(now)
    hits.set(ip, timestamps)
    next()
  }
}

import type { CorsOptions } from 'cors'

export function resolveCorsOrigin(
  origin: string | undefined,
  origins = process.env.FRONTEND_ORIGINS,
): string | false {
  if (!origin) return false

  const allowedOrigins = new Set(
    (origins ?? 'http://localhost:5173')
      .split(',')
      .map((allowedOrigin) => allowedOrigin.trim())
      .filter(Boolean),
  )

  return allowedOrigins.has(origin) ? origin : false
}

export function getCorsOptions(origins = process.env.FRONTEND_ORIGINS): CorsOptions {
  return {
    origin(origin, callback) {
      callback(null, resolveCorsOrigin(origin, origins))
    },
    credentials: true,
  }
}

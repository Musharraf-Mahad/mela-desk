import { createHash, randomBytes } from 'node:crypto'
import type { Request, Response } from 'express'

export const SESSION_COOKIE_NAME = 'mela_desk_session'
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7

export function createSessionToken(): string {
  return randomBytes(32).toString('hex')
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_SECONDS * 1000,
  })
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })
}

export function readSessionCookie(req: Request): string | undefined {
  const cookieHeader = req.headers.cookie
  if (!cookieHeader) return undefined

  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))

  return cookie?.slice(SESSION_COOKIE_NAME.length + 1)
}

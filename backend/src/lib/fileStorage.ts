import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { Request, Response } from 'express'

export const MAX_FILE_SIZE_BYTES = parseInt(process.env.MAX_FILE_SIZE_BYTES || '10485760', 10) // 10MB default
export const MAX_ATTACHMENTS_PER_TICKET = 5

export const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(import.meta.dirname, '../../storage/uploads')

// Ensure uploads directory exists securely
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true, mode: 0o750 })
}

// Allowed file extensions mapped to their canonical MIME type
export const ALLOWED_EXTENSIONS: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

// Explicitly blocked dangerous extensions
export const DANGEROUS_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.bash',
  '.php',
  '.phtml',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.html',
  '.htm',
  '.xhtml',
  '.svg',
  '.vbs',
  '.ps1',
  '.jar',
  '.py',
  '.rb',
  '.pl',
  '.dll',
  '.scr',
  '.msi',
  '.iso',
  '.com',
  '.cgi',
  '.asp',
  '.aspx',
])

export interface ParsedUploadedFile {
  originalFilename: string
  buffer: Buffer
  size: number
  declaredMimeType: string
}

export interface StoredAttachment {
  originalFilename: string
  storedFilename: string
  mimeType: string
  fileSize: number
  storagePath: string
}

/**
 * Validates file buffer against known magic numbers / headers to ensure
 * client didn't disguise a script or executable under an allowed extension.
 */
export function validateFileContent(buffer: Buffer, ext: string): { valid: boolean; reason?: string } {
  if (buffer.length === 0) {
    return { valid: false, reason: 'File is empty.' }
  }

  const lowerExt = ext.toLowerCase()

  if (lowerExt === '.png') {
    const isPng =
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    return isPng ? { valid: true } : { valid: false, reason: 'Invalid PNG image format.' }
  }

  if (lowerExt === '.jpg' || lowerExt === '.jpeg') {
    const isJpg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    return isJpg ? { valid: true } : { valid: false, reason: 'Invalid JPEG image format.' }
  }

  if (lowerExt === '.gif') {
    const header = buffer.subarray(0, 4).toString('ascii')
    const isGif = header === 'GIF8'
    return isGif ? { valid: true } : { valid: false, reason: 'Invalid GIF image format.' }
  }

  if (lowerExt === '.webp') {
    const riff = buffer.subarray(0, 4).toString('ascii')
    const webp = buffer.subarray(8, 12).toString('ascii')
    const isWebp = riff === 'RIFF' && webp === 'WEBP'
    return isWebp ? { valid: true } : { valid: false, reason: 'Invalid WEBP image format.' }
  }

  if (lowerExt === '.pdf') {
    const header = buffer.subarray(0, 5).toString('ascii')
    const isPdf = header.startsWith('%PDF-')
    return isPdf ? { valid: true } : { valid: false, reason: 'Invalid PDF document format.' }
  }

  if (lowerExt === '.docx' || lowerExt === '.xlsx') {
    // OpenXML documents are ZIP archives (PK\x03\x04)
    const isZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04
    return isZip ? { valid: true } : { valid: false, reason: 'Invalid Office document format.' }
  }

  if (lowerExt === '.txt' || lowerExt === '.csv') {
    // Text files must not contain binary nulls or active web script tags
    const sample = buffer.subarray(0, Math.min(buffer.length, 8192))
    if (sample.includes(0x00)) {
      return { valid: false, reason: 'Binary contents detected in text file.' }
    }
    const textSample = sample.toString('utf8').toLowerCase()
    if (
      textSample.includes('<script') ||
      textSample.includes('<?php') ||
      textSample.includes('<!doctype html') ||
      textSample.includes('<html') ||
      textSample.includes('<svg')
    ) {
      return { valid: false, reason: 'Active web script or HTML content is not permitted in text files.' }
    }
    return { valid: true }
  }

  return { valid: false, reason: `Unsupported file extension: ${ext}` }
}

/**
 * Validates and safely stores an uploaded file buffer to the uploads directory.
 */
export async function saveAttachmentFile(
  file: ParsedUploadedFile
): Promise<{ success: true; attachment: StoredAttachment } | { success: false; error: string }> {
  // Check size limit
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      success: false,
      error: `File "${file.originalFilename}" exceeds the maximum allowed size of ${Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024)}MB.`,
    }
  }

  // Sanitize original filename (prevent path traversal)
  const baseName = path.basename(file.originalFilename)
  const ext = path.extname(baseName).toLowerCase()

  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return {
      success: false,
      error: `File extension "${ext}" is blocked for security reasons.`,
    }
  }

  if (!ALLOWED_EXTENSIONS[ext]) {
    return {
      success: false,
      error: `File format "${ext}" is not supported. Allowed formats: ${Object.keys(ALLOWED_EXTENSIONS).join(', ')}.`,
    }
  }

  // Deep content validation (magic numbers)
  const contentValidation = validateFileContent(file.buffer, ext)
  if (!contentValidation.valid) {
    return {
      success: false,
      error: `File "${baseName}" failed content verification: ${contentValidation.reason}`,
    }
  }

  // Generate safe UUID-based stored filename
  const storedFilename = `${crypto.randomUUID()}${ext}`
  const storagePath = path.join(UPLOAD_DIR, storedFilename)

  // Double-check path traversal
  const resolved = path.resolve(storagePath)
  if (!resolved.startsWith(path.resolve(UPLOAD_DIR))) {
    return { success: false, error: 'Path traversal detected.' }
  }

  // Write file to storage
  await fs.promises.writeFile(storagePath, file.buffer)

  const sanitizedOriginalName = baseName.replace(/[^a-zA-Z0-9._ -]/g, '_')

  return {
    success: true,
    attachment: {
      originalFilename: sanitizedOriginalName,
      storedFilename,
      mimeType: ALLOWED_EXTENSIONS[ext],
      fileSize: file.size,
      storagePath,
    },
  }
}

/**
 * Safely removes a stored attachment file from disk.
 */
export async function removeAttachmentFile(storagePath: string): Promise<void> {
  try {
    const resolved = path.resolve(storagePath)
    if (!resolved.startsWith(path.resolve(UPLOAD_DIR))) return
    if (fs.existsSync(resolved)) {
      await fs.promises.unlink(resolved)
    }
  } catch (err) {
    console.error('Failed to unlink stored attachment file:', err)
  }
}

/**
 * Parses multipart/form-data natively using Node 24 web standard Request API.
 */
export async function parseMultipartFormData(
  req: Request
): Promise<{ fields: Record<string, string>; files: ParsedUploadedFile[] }> {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      if (Array.isArray(value)) value.forEach((v) => headers.append(key, v))
      else headers.set(key, value)
    }
  }

  const webReq = new globalThis.Request(`http://${req.headers.host || 'localhost'}${req.url}`, {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : (req as any),
    duplex: 'half',
  } as any)

  const formData = await webReq.formData()
  const fields: Record<string, string> = {}
  const files: ParsedUploadedFile[] = []

  for (const [key, val] of formData.entries()) {
    if (typeof val === 'string') {
      fields[key] = val
    } else if (val && typeof val === 'object' && 'arrayBuffer' in val) {
      const fileBlob = val as File
      const arrayBuf = await fileBlob.arrayBuffer()
      const buf = Buffer.from(arrayBuf)
      if (buf.length > 0 && fileBlob.name) {
        files.push({
          originalFilename: fileBlob.name,
          buffer: buf,
          size: buf.length,
          declaredMimeType: fileBlob.type || 'application/octet-stream',
        })
      }
    }
  }

  return { fields, files }
}

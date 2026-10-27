import type { ErrorRequestHandler } from 'express'

export const apiErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  const errorType =
    typeof error === 'object' && error !== null && 'type' in error ? error.type : undefined

  if (errorType === 'entity.parse.failed') {
    res.status(400).json({
      success: false,
      message: 'Malformed JSON request body',
    })
    return
  }

  if (errorType === 'entity.too.large') {
    res.status(413).json({
      success: false,
      message: 'JSON request body exceeds the allowed size',
    })
    return
  }

  if (res.headersSent) {
    next(error)
    return
  }

  console.error('Unhandled API error:', error)
  res.status(500).json({
    success: false,
    message: 'Internal server error',
  })
}

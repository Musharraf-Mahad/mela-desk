import type { ErrorRequestHandler } from 'express'

export const jsonBodyErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (typeof error !== 'object' || error === null || !('type' in error)) {
    next(error)
    return
  }

  const errorType = error.type

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

  next(error)
}

/**
 * Centralized error handling middleware for Express.
 */
function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  // Log the error in development
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[ERROR] ${statusCode} - ${message}`);
    if (err.stack) {
      console.error(err.stack);
    }
  }

  res.status(statusCode).json({
    error: {
      message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
}

/**
 * Helper to create an error with a status code.
 */
function createError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/**
 * Wrap async route handlers so thrown errors reach the error handler.
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  errorHandler,
  createError,
  asyncHandler,
};

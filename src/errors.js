/** Throw this anywhere to send a Hub Contract error response. */
class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function sendError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

// Unknown URL
function notFoundHandler(req, res) {
  return sendError(res, 404, 'NOT_FOUND', 'The request could not be completed.');
}

// Express 5 sends errors from async handlers here automatically.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return sendError(res, err.status, err.code, err.message);
  }
  // Broken JSON in the request body
  if (err && err.type === 'entity.parse.failed') {
    return sendError(res, 400, 'VALIDATION_FAILED', 'The request body is not valid JSON.');
  }
  if (err && err.type === 'entity.too.large') {
    return sendError(res, 400, 'VALIDATION_FAILED', 'The request body is too large.');
  }
  // Never show stack traces or SQL errors to the client
  console.error('UNEXPECTED ERROR:', err);
  return sendError(res, 500, 'SERVER_ERROR', 'Something went wrong on the server.');
}

module.exports = { AppError, sendError, notFoundHandler, errorHandler };

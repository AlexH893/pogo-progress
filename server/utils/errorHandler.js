/**
 * Centralized server error handling utility.
 * Maps raw database/server errors to human-readable error messages and structured error codes.
 */

const DB_ERROR_MAP = {
  ER_DUP_ENTRY: {
    message: 'A record with this information already exists.',
    code: 'ERR_DUPLICATE_ENTRY'
  },
  ER_NO_REFERENCED_ROW: {
    message: 'Referenced trainer or entity was not found.',
    code: 'ERR_REFERENCED_NOT_FOUND'
  },
  ER_NO_REFERENCED_ROW_2: {
    message: 'Referenced trainer or entity was not found.',
    code: 'ERR_REFERENCED_NOT_FOUND'
  },
  ER_DATA_TOO_LONG: {
    message: 'One of the provided values exceeds the maximum allowed length.',
    code: 'ERR_VALUE_TOO_LONG'
  },
  ER_BAD_FIELD_ERROR: {
    message: 'Database schema mismatch. A requested database column was not found.',
    code: 'ERR_SCHEMA_MISMATCH'
  },
  ER_PARSE_ERROR: {
    message: 'Database query syntax error.',
    code: 'ERR_DB_SYNTAX'
  },
  ECONNREFUSED: {
    message: 'Unable to connect to the database service. Please try again shortly.',
    code: 'ERR_DB_CONNECTION'
  },
  ER_ACCESS_DENIED_ERROR: {
    message: 'Database access authentication failed.',
    code: 'ERR_DB_AUTH'
  },
  PROTOCOL_CONNECTION_LOST: {
    message: 'Database connection was unexpectedly closed. Please retry your request.',
    code: 'ERR_DB_DISCONNECTED'
  }
};

/**
 * Normalizes an error object into a human-readable message and error code.
 * @param {Error|object} err 
 * @param {string} defaultMessage 
 * @returns {{ message: string, code: string }}
 */
function parseError(err, defaultMessage = 'An unexpected database error occurred.') {
  if (!err) {
    return { message: defaultMessage, code: 'ERR_UNKNOWN' };
  }

  const dbMapped = err.code ? DB_ERROR_MAP[err.code] : null;
  if (dbMapped) {
    return dbMapped;
  }

  if (err.userMessage && typeof err.userMessage === 'string') {
    return { message: err.userMessage, code: err.errorCode || 'ERR_CUSTOM' };
  }

  return { message: defaultMessage, code: 'ERR_INTERNAL_SERVER' };
}

/**
 * Handles server errors by logging them and returning a structured JSON response.
 * @param {object} res Express response object
 * @param {Error|object} err Error caught in try/catch
 * @param {string} defaultMessage Default fallback message for the user
 * @param {number} statusCode HTTP status code (defaults to 500)
 */
function handleServerError(res, err, defaultMessage = 'An unexpected server error occurred.', statusCode = 500) {
  console.error('[ServerError]', err);

  const { message, code } = parseError(err, defaultMessage);
  const isDevOrDebug = process.env.NODE_ENV !== 'production' || process.env.EXPOSE_ERROR_DETAILS === 'true';

  const responsePayload = {
    error: message,
    code
  };

  if (isDevOrDebug && err) {
    responsePayload.details = err.message || String(err);
    if (err.code) {
      responsePayload.dbCode = err.code;
    }
  }

  return res.status(statusCode).json(responsePayload);
}

module.exports = {
  parseError,
  handleServerError,
  DB_ERROR_MAP
};

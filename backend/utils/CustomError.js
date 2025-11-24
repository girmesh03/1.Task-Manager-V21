/**
 * Custom Error class for consistent error handling throughout the application
 * Provides static methods for common HTTP error types
 */
class CustomError extends Error {
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.name = this.constructor.name;

    // Capture stack trace, excluding constructor call from it
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Bad Request - 400
   * @param {string} message - Error message
   * @param {string} code - Optional error code
   * @returns {CustomError}
   */
  static badRequest(message, code = null) {
    return new CustomError(message, 400, code);
  }

  /**
   * Unauthenticated - 401
   * @param {string} message - Error message
   * @param {string} code - Optional error code
   * @returns {CustomError}
   */
  static unauthenticated(message = "Authentication required", code = null) {
    return new CustomError(message, 401, code);
  }

  /**
   * Forbidden - 403
   * @param {string} message - Error message
   * @param {string} code - Optional error code
   * @returns {CustomError}
   */
  static forbidden(
    message = "Forbidden, you don't have permission",
    code = null
  ) {
    return new CustomError(message, 403, code);
  }

  /**
   * Unauthorized - 401 (alias for unauthenticated for backward compatibility)
   * @param {string} message - Error message
   * @param {string} code - Optional error code
   * @returns {CustomError}
   */
  static unauthorized(message = "Authentication required", code = null) {
    return new CustomError(message, 401, code);
  }

  /**
   * Not Found - 404
   * @param {string} message - Error message
   * @param {string} code - Optional error code
   * @returns {CustomError}
   */
  static notFound(message = "Resource not found", code = null) {
    return new CustomError(message, 404, code);
  }

  /**
   * Conflict - 409
   * @param {string} message - Error message
   * @param {string} code - Optional error code
   * @returns {CustomError}
   */
  static conflict(message, code = null) {
    return new CustomError(message, 409, code);
  }

  /**
   * Unprocessable Entity - 422
   * @param {string} message - Error message
   * @param {string} code - Optional error code
   * @returns {CustomError}
   */
  static unprocessableEntity(message, code = null) {
    return new CustomError(message, 422, code);
  }

  /**
   * Internal Server Error - 500
   * @param {string} message - Error message
   * @param {string} code - Optional error code
   * @returns {CustomError}
   */
  static internalServer(message = "Internal server error", code = null) {
    return new CustomError(message, 500, code);
  }

  /**
   * Service Unavailable - 503
   * @param {string} message - Error message
   * @param {string} code - Optional error code
   * @returns {CustomError}
   */
  static serviceUnavailable(
    message = "Service temporarily unavailable",
    code = null
  ) {
    return new CustomError(message, 503, code);
  }
}

export default CustomError;

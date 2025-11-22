import CustomError from "../utils/CustomError.js";
import { validationResult } from "express-validator";

/**
 * Global error handling middleware
 * Handles all errors thrown in the application
 */
export const globalErrorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  if (process.env.NODE_ENV === "development") {
    console.error("Error Stack:", err.stack);
  } else {
    console.error("Error:", err.message);
  }

  // Mongoose bad ObjectId
  if (err.name === "CastError") {
    const message = "Invalid resource ID format";
    error = CustomError.badRequest(message, "INVALID_ID");
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    const message = `${
      field.charAt(0).toUpperCase() + field.slice(1)
    } '${value}' already exists`;
    error = CustomError.conflict(message, "DUPLICATE_FIELD");
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((val) => ({
      field: val.path,
      message: val.message,
    }));
    error = CustomError.badRequest("Validation failed", "VALIDATION_ERROR");
    error.errors = errors;
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    error = CustomError.unauthorized("Invalid token", "INVALID_TOKEN");
  }

  if (err.name === "TokenExpiredError") {
    error = CustomError.unauthorized("Token expired", "TOKEN_EXPIRED");
  }

  // Express-validator errors
  const validationErrors = validationResult(req);
  if (!validationErrors.isEmpty()) {
    const errors = validationErrors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
    }));

    return res.status(400).json({
      success: false,
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      errors: errors,
      timestamp: new Date().toISOString(),
    });
  }

  // Default to CustomError if it's an operational error
  if (!error.isOperational && !(error instanceof CustomError)) {
    error = CustomError.internalServer();
  }

  // Send error response
  const response = {
    success: false,
    error: error.message,
    timestamp: new Date().toISOString(),
  };

  // Add error code if available
  if (error.code) {
    response.code = error.code;
  }

  // Add validation errors if available
  if (error.errors) {
    response.errors = error.errors;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === "development") {
    response.stack = err.stack;
  }

  res.status(error.statusCode || 500).json(response);
};

/**
 * Async error handler wrapper
 * Catches async errors and passes them to the global error handler
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

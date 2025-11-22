import CustomError from "../utils/CustomError.js";

/**
 * 404 Not Found handler middleware
 * Handles requests to non-existent routes
 */
export const notFoundHandler = (req, res, next) => {
  const error = CustomError.notFound(
    `Route ${req.originalUrl} not found`,
    "ROUTE_NOT_FOUND"
  );
  next(error);
};

import asyncHandler from "express-async-handler";
import User from "../models/User.js";
import CustomError from "../utils/CustomError.js";
import {
  verifyAccessToken,
  extractTokensFromCookies,
} from "../utils/jwtUtils.js";

/**
 * Authentication Middleware
 * Validates JWT tokens from HTTP-only cookies and attaches user to request
 */

/**
 * Authenticate user from JWT token in HTTP-only cookies
 * Validates token and attaches user object to req.user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  try {
    // Extract tokens from cookies
    const { accessToken } = extractTokensFromCookies(req);

    if (!accessToken) {
      throw CustomError.unauthorized("Authentication required. Please log in.");
    }

    // Verify access token
    const decoded = verifyAccessToken(accessToken);

    // Fetch user from database with populated organization and department
    // Select soft delete fields explicitly before accessing them
    const user = await User.findById(decoded.userId)
      .populate({
        path: "organization",
        select: "name _id isPlatformOrg isDeleted deletedAt deletedBy",
      })
      .populate({
        path: "department",
        select: "name _id isDeleted deletedAt deletedBy",
      })
      .select(
        "-password -refreshToken -refreshTokenExpiry +isDeleted +deletedAt +deletedBy"
      );

    if (!user) {
      throw CustomError.unauthorized("User not found. Please log in again.");
    }

    // Check if user is soft deleted
    if (user.isDeleted) {
      throw CustomError.unauthorized("User account is deactivated.");
    }

    // Check if user's organization is soft deleted
    if (user.organization?.isDeleted) {
      throw CustomError.unauthorized("Organization is deactivated.");
    }

    // Check if user's department is soft deleted
    if (user.department?.isDeleted) {
      throw CustomError.unauthorized("Department is deactivated.");
    }

    // Verify token data matches user data (security check)
    if (
      decoded.email !== user.email ||
      decoded.organizationId !== user.organization._id.toString() ||
      decoded.departmentId !== user.department._id.toString()
    ) {
      throw CustomError.unauthorized(
        "Token data mismatch. Please log in again."
      );
    }

    // Attach user to request object with required context fields
    req.user = {
      ...user.toObject(),
      // Ensure required fields are attached as per Requirements 3.2
      organization: {
        _id: user.organization._id,
        name: user.organization.name,
        isPlatformOrg: user.organization.isPlatformOrg || false,
      },
      department: {
        _id: user.department._id,
        name: user.department.name,
      },
      // Platform and HOD flags
      isPlatformUser: user.isPlatformUser || false,
      isHod: user.isHod || false,
    };

    // Attach decoded token data for quick access
    req.tokenData = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      organizationId: decoded.organizationId,
      departmentId: decoded.departmentId,
    };

    next();
  } catch (error) {
    // Handle specific JWT errors
    if (error.name === "TokenExpiredError") {
      throw CustomError.unauthorized(
        "Access token has expired. Please refresh your session."
      );
    } else if (error.name === "JsonWebTokenError") {
      throw CustomError.unauthorized(
        "Invalid access token. Please log in again."
      );
    } else if (error instanceof CustomError) {
      throw error;
    } else {
      console.error("Authentication error:", error);
      throw CustomError.unauthorized(
        "Authentication failed. Please log in again."
      );
    }
  }
});

/**
 * Optional authentication middleware
 * Attempts to authenticate user but doesn't throw error if no token
 * Useful for endpoints that work for both authenticated and unauthenticated users
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const optionalAuth = asyncHandler(async (req, res, next) => {
  try {
    // Extract tokens from cookies
    const { accessToken } = extractTokensFromCookies(req);

    if (!accessToken) {
      // No token provided, continue without authentication
      return next();
    }

    // Try to verify and authenticate
    const decoded = verifyAccessToken(accessToken);

    const user = await User.findById(decoded.userId)
      .populate({
        path: "organization",
        select: "name _id isPlatformOrg isDeleted deletedAt deletedBy",
      })
      .populate({
        path: "department",
        select: "name _id isDeleted deletedAt deletedBy",
      })
      .select(
        "-password -refreshToken -refreshTokenExpiry +isDeleted +deletedAt +deletedBy"
      );

    if (
      user &&
      !user.isDeleted &&
      !user.organization?.isDeleted &&
      !user.department?.isDeleted
    ) {
      // Verify token data matches user data
      if (
        decoded.email === user.email &&
        decoded.organizationId === user.organization._id.toString() &&
        decoded.departmentId === user.department._id.toString()
      ) {
        // Attach user with required context fields
        req.user = {
          ...user.toObject(),
          organization: {
            _id: user.organization._id,
            name: user.organization.name,
            isPlatformOrg: user.organization.isPlatformOrg || false,
          },
          department: {
            _id: user.department._id,
            name: user.department.name,
          },
          isPlatformUser: user.isPlatformUser || false,
          isHod: user.isHod || false,
        };
        req.tokenData = {
          userId: decoded.userId,
          email: decoded.email,
          role: decoded.role,
          organizationId: decoded.organizationId,
          departmentId: decoded.departmentId,
        };
      }
    }

    next();
  } catch (error) {
    // For optional auth, we don't throw errors, just continue without user
    console.warn("Optional authentication failed:", error.message);
    next();
  }
});

/**
 * Middleware to check if user is authenticated
 * Simpler version that just checks if req.user exists
 * Should be used after authenticate middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const requireAuth = (req, res, next) => {
  if (!req.user) {
    throw CustomError.unauthorized("Authentication required. Please log in.");
  }
  next();
};

/**
 * Middleware to check if user account is active
 * Verifies user, organization, and department are not soft deleted
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const requireActiveAccount = (req, res, next) => {
  if (!req.user) {
    throw CustomError.unauthorized("Authentication required.");
  }

  if (req.user.isDeleted) {
    throw CustomError.forbidden("User account is deactivated.");
  }

  if (req.user.organization?.isDeleted) {
    throw CustomError.forbidden("Organization is deactivated.");
  }

  if (req.user.department?.isDeleted) {
    throw CustomError.forbidden("Department is deactivated.");
  }

  next();
};

/**
 * Middleware to validate token freshness
 * Checks if token was issued recently (useful for sensitive operations)
 * @param {number} maxAgeMinutes - Maximum age of token in minutes
 * @returns {Function} Express middleware function
 */
export const requireFreshToken = (maxAgeMinutes = 30) => {
  return (req, res, next) => {
    if (!req.tokenData) {
      throw CustomError.unauthorized("Authentication required.");
    }

    const { accessToken } = extractTokensFromCookies(req);
    if (!accessToken) {
      throw CustomError.unauthorized("Access token required.");
    }

    try {
      const decoded = verifyAccessToken(accessToken);
      const tokenAge = (Date.now() - decoded.iat * 1000) / (1000 * 60); // Age in minutes

      if (tokenAge > maxAgeMinutes) {
        throw CustomError.unauthorized(
          `Token is too old. Please re-authenticate within the last ${maxAgeMinutes} minutes.`
        );
      }

      next();
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      throw CustomError.unauthorized("Token validation failed.");
    }
  };
};

/**
 * Middleware to check if user is platform admin
 * Platform admins belong to the special platform organization
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const requirePlatformAdmin = (req, res, next) => {
  if (!req.user) {
    throw CustomError.unauthorized("Authentication required.");
  }

  if (!req.user.isPlatformUser && !req.user.organization.isPlatformOrg) {
    throw CustomError.forbidden("Platform administrator access required.");
  }

  if (req.user.role !== "SuperAdmin") {
    throw CustomError.forbidden("Platform SuperAdmin role required.");
  }

  next();
};

export default {
  authenticate,
  optionalAuth,
  requireAuth,
  requireActiveAccount,
  requireFreshToken,
  requirePlatformAdmin,
};

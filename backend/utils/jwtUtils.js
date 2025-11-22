import jwt from "jsonwebtoken";
import CustomError from "./CustomError.js";

/**
 * JWT Token Utilities
 * Handles JWT token generation, validation, and refresh mechanisms
 * Supports access/refresh token pattern with HTTP-only cookie storage
 */

// Token configuration - use getters to ensure env vars are loaded when accessed
const getAccessTokenExpiresIn = () => process.env.JWT_ACCESS_EXPIRES_IN || "1d";
const getRefreshTokenExpiresIn = () =>
  process.env.JWT_REFRESH_EXPIRES_IN || "7d";
const getAccessTokenSecret = () => process.env.JWT_ACCESS_SECRET;
const getRefreshTokenSecret = () => process.env.JWT_REFRESH_SECRET;

// Cookie configuration - use getter to ensure env vars are loaded
const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/",
});

/**
 * Generate JWT access token
 * @param {Object} payload - User payload to encode in token
 * @returns {string} JWT access token
 */
export const generateAccessToken = (payload) => {
  const accessTokenSecret = getAccessTokenSecret();
  if (!accessTokenSecret) {
    throw CustomError.internalServer("JWT access secret not configured");
  }

  return jwt.sign(payload, accessTokenSecret, {
    expiresIn: getAccessTokenExpiresIn(),
    issuer: "task-manager-saas",
    audience: "task-manager-users",
  });
};

/**
 * Generate JWT refresh token
 * @param {Object} payload - User payload to encode in token
 * @returns {string} JWT refresh token
 */
export const generateRefreshToken = (payload) => {
  const refreshTokenSecret = getRefreshTokenSecret();
  if (!refreshTokenSecret) {
    throw CustomError.internalServer("JWT refresh secret not configured");
  }

  return jwt.sign(payload, refreshTokenSecret, {
    expiresIn: getRefreshTokenExpiresIn(),
    issuer: "task-manager-saas",
    audience: "task-manager-users",
  });
};

/**
 * Generate both access and refresh tokens
 * @param {Object} user - User object with necessary fields
 * @returns {Object} Object containing access and refresh tokens
 */
export const generateTokenPair = (user) => {
  // Validate required user fields
  if (!user._id || !user.email || !user.role) {
    throw CustomError.internalServer("Invalid user data for token generation");
  }

  // Handle organization ID - could be populated object or ObjectId
  let organizationId;
  if (user.organization) {
    organizationId = user.organization._id || user.organization;
  } else {
    throw CustomError.internalServer(
      "User organization is required for token generation"
    );
  }

  // Handle department ID - could be populated object or ObjectId
  let departmentId;
  if (user.department) {
    departmentId = user.department._id || user.department;
  } else {
    throw CustomError.internalServer(
      "User department is required for token generation"
    );
  }

  const payload = {
    userId: user._id,
    email: user.email,
    role: user.role,
    organizationId: organizationId.toString(),
    departmentId: departmentId.toString(),
    isPlatformUser: user.isPlatformUser || false,
    isHod: user.isHod || false,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken({ userId: user._id });

  return { accessToken, refreshToken };
};

/**
 * Verify JWT access token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 * @throws {CustomError} If token is invalid or expired
 */
export const verifyAccessToken = (token) => {
  if (!token) {
    throw CustomError.unauthorized("Access token is required");
  }

  const accessTokenSecret = getAccessTokenSecret();
  if (!accessTokenSecret) {
    throw CustomError.internalServer("JWT access secret not configured");
  }

  try {
    return jwt.verify(token, accessTokenSecret, {
      issuer: "task-manager-saas",
      audience: "task-manager-users",
    });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw CustomError.unauthorized("Access token has expired");
    } else if (error.name === "JsonWebTokenError") {
      throw CustomError.unauthorized("Invalid access token");
    } else {
      throw CustomError.unauthorized("Token verification failed");
    }
  }
};

/**
 * Verify JWT refresh token
 * @param {string} token - JWT refresh token to verify
 * @returns {Object} Decoded token payload
 * @throws {CustomError} If token is invalid or expired
 */
export const verifyRefreshToken = (token) => {
  if (!token) {
    throw CustomError.unauthorized("Refresh token is required");
  }

  const refreshTokenSecret = getRefreshTokenSecret();
  if (!refreshTokenSecret) {
    throw CustomError.internalServer("JWT refresh secret not configured");
  }

  try {
    return jwt.verify(token, refreshTokenSecret, {
      issuer: "task-manager-saas",
      audience: "task-manager-users",
    });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw CustomError.unauthorized("Refresh token has expired");
    } else if (error.name === "JsonWebTokenError") {
      throw CustomError.unauthorized("Invalid refresh token");
    } else {
      throw CustomError.unauthorized("Refresh token verification failed");
    }
  }
};

/**
 * Set authentication cookies in response
 * @param {Object} res - Express response object
 * @param {string} accessToken - JWT access token
 * @param {string} refreshToken - JWT refresh token
 */
export const setAuthCookies = (res, accessToken, refreshToken) => {
  // Calculate cookie expiration times
  const accessTokenMaxAge = getTokenExpirationMs(getAccessTokenExpiresIn());
  const refreshTokenMaxAge = getTokenExpirationMs(getRefreshTokenExpiresIn());
  const cookieOptions = getCookieOptions();

  // Set access token cookie
  res.cookie("accessToken", accessToken, {
    ...cookieOptions,
    maxAge: accessTokenMaxAge,
  });

  // Set refresh token cookie
  res.cookie("refreshToken", refreshToken, {
    ...cookieOptions,
    maxAge: refreshTokenMaxAge,
  });
};

/**
 * Clear authentication cookies from response
 * @param {Object} res - Express response object
 */
export const clearAuthCookies = (res) => {
  const cookieOptions = getCookieOptions();
  res.clearCookie("accessToken", cookieOptions);
  res.clearCookie("refreshToken", cookieOptions);
};

/**
 * Extract tokens from request cookies
 * @param {Object} req - Express request object
 * @returns {Object} Object containing access and refresh tokens
 */
export const extractTokensFromCookies = (req) => {
  return {
    accessToken: req.cookies?.accessToken,
    refreshToken: req.cookies?.refreshToken,
  };
};

/**
 * Convert time string to milliseconds
 * @param {string} timeString - Time string (e.g., '1d', '7d', '1h')
 * @returns {number} Time in milliseconds
 */
const getTokenExpirationMs = (timeString) => {
  const timeValue = parseInt(timeString);
  const timeUnit = timeString.slice(-1);

  switch (timeUnit) {
    case "s":
      return timeValue * 1000;
    case "m":
      return timeValue * 60 * 1000;
    case "h":
      return timeValue * 60 * 60 * 1000;
    case "d":
      return timeValue * 24 * 60 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000; // Default to 1 day
  }
};

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - Valid refresh token
 * @param {Function} getUserById - Function to fetch user by ID
 * @returns {Object} New access token and user data
 * @throws {CustomError} If refresh token is invalid or user not found
 */
export const refreshAccessToken = async (refreshToken, getUserById) => {
  // Verify refresh token
  const decoded = verifyRefreshToken(refreshToken);

  // Fetch user data
  const user = await getUserById(decoded.userId);
  if (!user) {
    throw CustomError.unauthorized("User not found");
  }

  // Generate new access token
  const newAccessToken = generateAccessToken({
    userId: user._id,
    email: user.email,
    role: user.role,
    organizationId: user.organization._id || user.organization,
    departmentId: user.department._id || user.department,
    isPlatformUser: user.isPlatformUser || false,
    isHod: user.isHod || false,
  });

  return { accessToken: newAccessToken, user };
};

export default {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  extractTokensFromCookies,
  refreshAccessToken,
};

/**
 * Date Conversion Middleware
 * Automatically converts dates between UTC (database) and local time (API)
 */

import { formatForAPI, toUTC } from "../utils/timezoneUtils.js";

/**
 * Middleware to convert UTC dates to user's timezone in API responses
 * Adds timezone-aware date formatting to response objects
 */
export const convertDatesForResponse = (req, res, next) => {
  const originalJson = res.json;

  // Get user's timezone from request (could be from user profile, headers, or query)
  const userTimezone =
    req.user?.timezone ||
    req.headers["x-timezone"] ||
    req.query.timezone ||
    null;

  res.json = function (data) {
    if (data && typeof data === "object") {
      const convertedData = convertObjectDates(data, userTimezone, "toLocal");
      return originalJson.call(this, convertedData);
    }
    return originalJson.call(this, data);
  };

  next();
};

/**
 * Middleware to convert local dates to UTC for database storage
 * Processes request body dates before they reach controllers
 */
export const convertDatesForStorage = (req, res, next) => {
  if (req.body && typeof req.body === "object") {
    const userTimezone =
      req.user?.timezone ||
      req.headers["x-timezone"] ||
      req.query.timezone ||
      null;
    req.body = convertObjectDates(req.body, userTimezone, "toUTC");
  }

  next();
};

/**
 * Recursively convert date fields in an object
 * @param {Object|Array} obj - Object to process
 * @param {string} userTimezone - User's timezone
 * @param {string} direction - 'toLocal' or 'toUTC'
 * @returns {Object|Array} Processed object
 */
function convertObjectDates(obj, userTimezone, direction) {
  if (!obj || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => convertObjectDates(item, userTimezone, direction));
  }

  const converted = {};

  for (const [key, value] of Object.entries(obj)) {
    if (isDateField(key) && value) {
      if (direction === "toLocal") {
        converted[key] = formatForAPI(value, userTimezone);
      } else if (direction === "toUTC") {
        converted[key] = toUTC(value, userTimezone);
      } else {
        converted[key] = value;
      }
    } else if (value && typeof value === "object") {
      converted[key] = convertObjectDates(value, userTimezone, direction);
    } else {
      converted[key] = value;
    }
  }

  return converted;
}

/**
 * Check if a field name indicates it contains a date
 * @param {string} fieldName - Field name to check
 * @returns {boolean} True if field likely contains a date
 */
function isDateField(fieldName) {
  const dateFieldPatterns = [
    /date$/i,
    /time$/i,
    /at$/i,
    /^created/i,
    /^updated/i,
    /^deleted/i,
    /^completed/i,
    /^due/i,
    /^last/i,
    /^expires/i,
    /^scheduled/i,
  ];

  return dateFieldPatterns.some((pattern) => pattern.test(fieldName));
}

/**
 * Utility function to manually convert dates in controller responses
 * Use this when you need more control over date conversion
 * @param {Object} data - Data to convert
 * @param {string} userTimezone - User's timezone
 * @returns {Object} Converted data
 */
export const convertResponseDates = (data, userTimezone = null) => {
  return convertObjectDates(data, userTimezone, "toLocal");
};

/**
 * Utility function to manually convert dates for database storage
 * Use this when you need more control over date conversion
 * @param {Object} data - Data to convert
 * @param {string} userTimezone - User's timezone
 * @returns {Object} Converted data
 */
export const convertStorageDates = (data, userTimezone = null) => {
  return convertObjectDates(data, userTimezone, "toUTC");
};

export default {
  convertDatesForResponse,
  convertDatesForStorage,
  convertResponseDates,
  convertStorageDates,
};

/**
 * Timezone Utility Functions
 * Handles UTC storage and local time conversion for consistent date handling
 */

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

// Ensure plugins are loaded
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Convert local date/time to UTC for database storage
 * @param {string|Date|dayjs} localDate - Local date/time
 * @param {string} userTimezone - User's timezone (optional)
 * @returns {Date} UTC Date object for MongoDB storage
 */
export const toUTC = (localDate, userTimezone = null) => {
  if (!localDate) return null;

  let dayjsDate;

  if (userTimezone) {
    // If timezone is provided, treat the input as being in that timezone
    dayjsDate = dayjs.tz(localDate, userTimezone);
  } else {
    // Otherwise, treat as local system time
    dayjsDate = dayjs(localDate);
  }

  return dayjsDate.utc().toDate();
};

/**
 * Convert UTC date from database to local timezone
 * @param {Date|string} utcDate - UTC date from database
 * @param {string} userTimezone - Target timezone (default: system timezone)
 * @returns {dayjs.Dayjs} Dayjs object in target timezone
 */
export const toLocal = (utcDate, userTimezone = null) => {
  if (!utcDate) return null;

  const utcDayjs = dayjs.utc(utcDate);

  if (userTimezone) {
    return utcDayjs.tz(userTimezone);
  }

  // Return in system local timezone
  return utcDayjs.local();
};

/**
 * Format UTC date for display in user's timezone
 * @param {Date|string} utcDate - UTC date from database
 * @param {string} format - Display format (default: 'YYYY-MM-DD HH:mm')
 * @param {string} userTimezone - User's timezone
 * @returns {string} Formatted date string
 */
export const formatForDisplay = (
  utcDate,
  format = "YYYY-MM-DD HH:mm",
  userTimezone = null
) => {
  if (!utcDate) return "";

  const localDate = toLocal(utcDate, userTimezone);
  return localDate.format(format);
};

/**
 * Format UTC date for API response with timezone info
 * @param {Date|string} utcDate - UTC date from database
 * @param {string} userTimezone - User's timezone
 * @returns {Object} Object with UTC and local time representations
 */
export const formatForAPI = (utcDate, userTimezone = null) => {
  if (!utcDate) return null;

  const utcDayjs = dayjs.utc(utcDate);
  const localDayjs = userTimezone
    ? utcDayjs.tz(userTimezone)
    : utcDayjs.local();

  return {
    utc: utcDayjs.toISOString(),
    local: localDayjs.format(),
    timezone: userTimezone || dayjs.tz.guess(),
    timestamp: utcDayjs.valueOf(),
  };
};

/**
 * Get current UTC time for database operations
 * @returns {Date} Current UTC Date object
 */
export const nowUTC = () => {
  return dayjs.utc().toDate();
};

/**
 * Check if a date is in the past (UTC comparison)
 * @param {Date|string} date - Date to check
 * @returns {boolean} True if date is in the past
 */
export const isPast = (date) => {
  if (!date) return false;
  return dayjs.utc(date).isBefore(dayjs.utc());
};

/**
 * Check if a date is in the future (UTC comparison)
 * @param {Date|string} date - Date to check
 * @returns {boolean} True if date is in the future
 */
export const isFuture = (date) => {
  if (!date) return false;
  return dayjs.utc(date).isAfter(dayjs.utc());
};

/**
 * Add time to a UTC date
 * @param {Date|string} utcDate - Base UTC date
 * @param {number} amount - Amount to add
 * @param {string} unit - Unit (days, hours, minutes, etc.)
 * @returns {Date} New UTC Date object
 */
export const addTime = (utcDate, amount, unit) => {
  if (!utcDate) return null;
  return dayjs.utc(utcDate).add(amount, unit).toDate();
};

/**
 * Subtract time from a UTC date
 * @param {Date|string} utcDate - Base UTC date
 * @param {number} amount - Amount to subtract
 * @param {string} unit - Unit (days, hours, minutes, etc.)
 * @returns {Date} New UTC Date object
 */
export const subtractTime = (utcDate, amount, unit) => {
  if (!utcDate) return null;
  return dayjs.utc(utcDate).subtract(amount, unit).toDate();
};

/**
 * Get start of day in UTC
 * @param {Date|string} date - Date to get start of day for
 * @returns {Date} Start of day in UTC
 */
export const startOfDayUTC = (date = null) => {
  const baseDate = date ? dayjs.utc(date) : dayjs.utc();
  return baseDate.startOf("day").toDate();
};

/**
 * Get end of day in UTC
 * @param {Date|string} date - Date to get end of day for
 * @returns {Date} End of day in UTC
 */
export const endOfDayUTC = (date = null) => {
  const baseDate = date ? dayjs.utc(date) : dayjs.utc();
  return baseDate.endOf("day").toDate();
};

/**
 * Parse date string with timezone awareness
 * @param {string} dateString - Date string to parse
 * @param {string} userTimezone - User's timezone
 * @returns {Date} UTC Date object
 */
export const parseDate = (dateString, userTimezone = null) => {
  if (!dateString) return null;

  if (userTimezone) {
    return dayjs.tz(dateString, userTimezone).utc().toDate();
  }

  return dayjs(dateString).utc().toDate();
};

/**
 * Get timezone offset for a specific timezone
 * @param {string} timezone - Timezone identifier
 * @param {Date} date - Date to get offset for (default: now)
 * @returns {number} Offset in minutes
 */
export const getTimezoneOffset = (timezone, date = new Date()) => {
  const utcDate = dayjs.utc(date);
  const tzDate = utcDate.tz(timezone);
  return tzDate.utcOffset();
};

/**
 * Validate timezone identifier
 * @param {string} timezone - Timezone to validate
 * @returns {boolean} True if valid timezone
 */
export const isValidTimezone = (timezone) => {
  try {
    dayjs.tz.setDefault(timezone);
    dayjs.tz.setDefault(); // Reset to system default
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Get list of common timezone identifiers
 * @returns {Array<string>} Array of timezone identifiers
 */
export const getCommonTimezones = () => {
  return [
    "UTC",
    "Africa/Nairobi",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Asia/Kolkata",
    "Australia/Sydney",
    "Pacific/Auckland",
  ];
};

export default {
  toUTC,
  toLocal,
  formatForDisplay,
  formatForAPI,
  nowUTC,
  isPast,
  isFuture,
  addTime,
  subtractTime,
  startOfDayUTC,
  endOfDayUTC,
  parseDate,
  getTimezoneOffset,
  isValidTimezone,
  getCommonTimezones,
};

// client/src/utils/constants.js
/**
 * Centralized Application Constants
 */

// ==================== HTTP STATUS CODES ====================
/**
 * HTTP status codes for consistent error handling
 */
export const HTTP_STATUS = {
  // Success
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,

  // Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // Server Errors
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

// ==================== LOADING MESSAGES ====================
/**
 * Loading state messages
 * Used for consistent loading indicators
 */
export const LOADING_MESSAGES = {
  CHECKING_AUTH: "Checking authentication...",
  LOADING: "Loading...",
  PLEASE_WAIT: "Please wait...",
  CONNECTING: "Connecting...",
  RECONNECTING: "Reconnecting...",
};

// ==================== UI MESSAGES ====================
/**
 * User interface messages and placeholders
 * Used for consistent UI text
 */
export const UI_MESSAGES = {
  PLACEHOLDERS: {
    SELECT_OPTION: "Select an option",
    SELECT_OPTIONS: "Select options",
    SEARCH: "Search...",
    ENTER_TEXT: "Enter text...",
  },
  ERRORS: {
    SOMETHING_WENT_WRONG: "Something went wrong",
    PLEASE_TRY_AGAIN: "Please try again",
    NETWORK_ERROR: "Network connection issue. Please check your internet.",
    SESSION_EXPIRED: "Your session has expired. Please log in again.",
    AUTHENTICATION_REQUIRED: "Authentication Required",
    UNABLE_TO_LOAD: "Unable to Load Content",
  },
  ACTIONS: {
    RELOAD_PAGE: "Reload Page",
    GO_HOME: "Go Home",
    TRY_AGAIN: "Try Again",
    GO_TO_LOGIN: "Go to Login",
    CLOSE: "Close",
  },
};

// ==================== TOAST CONFIGURATION ====================
/**
 * Toast notification configuration
 * Used with react-toastify
 */
export const TOAST_CONFIG = {
  // Default toast options
  DEFAULT: {
    position: "bottom-right",
    autoClose: 5000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
  },

  // Quick toast (shorter duration)
  QUICK: {
    autoClose: 3000,
  },

  // Persistent toast (longer duration)
  PERSISTENT: {
    autoClose: 10000,
  },

  // No auto-close (manual dismiss only)
  MANUAL: {
    autoClose: false,
  },
};

// ==================== PAGINATION CONFIGURATION ====================
/**
 * Pagination configuration
 * Used for data tables and lists
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  DEFAULT_SORT_BY: "createdAt",
  DEFAULT_SORT_ORDER: "desc",

  // Page size options for dropdowns
  PAGE_SIZE_OPTIONS: [5, 10, 25, 50, 100],

  // Maximum items per page
  MAX_LIMIT: 100,
};

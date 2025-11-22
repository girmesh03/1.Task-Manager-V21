/**
 * System Constants and Enums
 * Centralized constants for the Task Manager SaaS application
 */

// Platform identification constants
export const PLATFORM_FIELDS = {
  IS_PLATFORM_ORG: true,
  IS_NOT_PLATFORM_ORG: false,
  IS_PLATFORM_USER: true,
  IS_NOT_PLATFORM_USER: false,
  IS_HOD: true,
  IS_NOT_HOD: false,
};

// User Roles
export const USER_ROLES = {
  SUPER_ADMIN: "SuperAdmin",
  ADMIN: "Admin",
  MANAGER: "Manager",
  USER: "User",
};

export const USER_ROLES_ARRAY = Object.values(USER_ROLES);

// User Status
export const USER_STATUS = {
  ONLINE: "online",
  OFFLINE: "offline",
  AWAY: "away",
};

export const USER_STATUS_ARRAY = Object.values(USER_STATUS);

// Organization Sizes
export const ORGANIZATION_SIZES = {
  SMALL: "Small",
  MEDIUM: "Medium",
  LARGE: "Large",
  ENTERPRISE: "Enterprise",
};

export const ORGANIZATION_SIZES_ARRAY = Object.values(ORGANIZATION_SIZES);

// Task Status
export const TASK_STATUS = {
  TO_DO: "To Do",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  ON_HOLD: "On Hold",
};

export const TASK_STATUS_ARRAY = Object.values(TASK_STATUS);

// Task Priority
export const TASK_PRIORITY = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const TASK_PRIORITY_ARRAY = Object.values(TASK_PRIORITY);

// Task Types (Discriminator Keys)
export const TASK_TYPES = {
  ROUTINE_TASK: "RoutineTask",
  ASSIGNED_TASK: "AssignedTask",
  PROJECT_TASK: "ProjectTask",
};

export const TASK_TYPES_ARRAY = Object.values(TASK_TYPES);

// Task Frequency (for RoutineTask)
export const TASK_FREQUENCY = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
};

export const TASK_FREQUENCY_ARRAY = Object.values(TASK_FREQUENCY);

// Task Activity Status
export const TASK_ACTIVITY_STATUS = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  BLOCKED: "Blocked",
};

export const TASK_ACTIVITY_STATUS_ARRAY = Object.values(TASK_ACTIVITY_STATUS);

// Notification Types
export const NOTIFICATION_TYPES = {
  TASK_ASSIGNED: "task_assigned",
  TASK_UPDATED: "task_updated",
  TASK_COMPLETED: "task_completed",
  COMMENT_ADDED: "comment_added",
  MENTION: "mention",
  ACTIVITY_ADDED: "activity_added",
  SYSTEM: "system",
};

export const NOTIFICATION_TYPES_ARRAY = Object.values(NOTIFICATION_TYPES);

// Notification Status
export const NOTIFICATION_STATUS = {
  UNREAD: "unread",
  READ: "read",
};

export const NOTIFICATION_STATUS_ARRAY = Object.values(NOTIFICATION_STATUS);

// Notification Priority
export const NOTIFICATION_PRIORITY = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  URGENT: "urgent",
};

export const NOTIFICATION_PRIORITY_ARRAY = Object.values(NOTIFICATION_PRIORITY);

// Attachment Types
export const ATTACHMENT_TYPES = {
  IMAGE: "image",
  DOCUMENT: "document",
  VIDEO: "video",
  OTHER: "other",
};

export const ATTACHMENT_TYPES_ARRAY = Object.values(ATTACHMENT_TYPES);

// Attachment Models (Polymorphic)
export const ATTACHMENT_MODELS = {
  BASE_TASK: "BaseTask",
  TASK_ACTIVITY: "TaskActivity",
  TASK_COMMENT: "TaskComment",
};

export const ATTACHMENT_MODELS_ARRAY = Object.values(ATTACHMENT_MODELS);

// Validation Limits
export const VALIDATION_LIMITS = {
  // String lengths
  FIRST_NAME_MAX: 50,
  LAST_NAME_MAX: 50,
  EMAIL_MAX: 255,
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 128,
  POSITION_MAX: 100,
  ORGANIZATION_NAME_MAX: 100,
  ORGANIZATION_DESCRIPTION_MAX: 500,
  ORGANIZATION_ADDRESS_MAX: 200,
  ORGANIZATION_INDUSTRY_MAX: 100,
  DEPARTMENT_NAME_MAX: 100,
  DEPARTMENT_DESCRIPTION_MAX: 500,
  TASK_TITLE_MAX: 200,
  TASK_DESCRIPTION_MAX: 2000,
  COMMENT_CONTENT_MAX: 1000,
  ACTIVITY_DESCRIPTION_MAX: 1000,
  MATERIAL_NAME_MAX: 100,
  MATERIAL_DESCRIPTION_MAX: 500,
  VENDOR_NAME_MAX: 100,
  VENDOR_CONTACT_INFO_MAX: 255,
  VENDOR_SERVICE_CATEGORIES_MAX: 500,
  NOTIFICATION_TITLE_MAX: 200,
  NOTIFICATION_MESSAGE_MAX: 1000,

  // Numeric limits
  ESTIMATED_DURATION_MIN: 1, // minutes
  ESTIMATED_DURATION_MAX: 480, // 8 hours in minutes
  COST_MIN: 0,
  COST_MAX: 999999999.99,
  MATERIAL_QUANTITY_MIN: 0,
  MATERIAL_QUANTITY_MAX: 999999,

  // File upload limits
  FILE_SIZE_MAX: 10 * 1024 * 1024, // 10MB in bytes

  // Pagination limits
  PAGE_SIZE_DEFAULT: 20,
  PAGE_SIZE_MAX: 100,

  // Rate limiting
  RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes in milliseconds
  RATE_LIMIT_MAX_REQUESTS: 100,
  AUTH_RATE_LIMIT_MAX_REQUESTS: 5, // For login/register endpoints

  // JWT Token expiry
  ACCESS_TOKEN_EXPIRY: "15m",
  REFRESH_TOKEN_EXPIRY: "7d",

  // Socket.IO
  SOCKET_RECONNECTION_ATTEMPTS: 5,
  SOCKET_RECONNECTION_DELAY: 1000, // milliseconds
};

// File Upload Configuration
export const FILE_UPLOAD = {
  ALLOWED_IMAGE_TYPES: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ],
  ALLOWED_DOCUMENT_TYPES: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
  ],
  ALLOWED_VIDEO_TYPES: ["video/mp4", "video/avi", "video/mov", "video/wmv"],
  MAX_FILE_SIZE: VALIDATION_LIMITS.FILE_SIZE_MAX,
};

// All allowed file types combined
export const ALLOWED_FILE_TYPES = [
  ...FILE_UPLOAD.ALLOWED_IMAGE_TYPES,
  ...FILE_UPLOAD.ALLOWED_DOCUMENT_TYPES,
  ...FILE_UPLOAD.ALLOWED_VIDEO_TYPES,
];

// Business Rules
export const BUSINESS_RULES = {
  // RoutineTask restrictions
  ROUTINE_TASK_FORBIDDEN_STATUS: [TASK_STATUS.TO_DO],
  ROUTINE_TASK_FORBIDDEN_PRIORITY: [TASK_PRIORITY.LOW],

  // HOD roles that require position uniqueness
  HOD_ROLES: [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN],

  // Roles that can see cross-department data
  CROSS_DEPT_ROLES: [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN],

  // Task types that support activities
  ACTIVITY_SUPPORTED_TASK_TYPES: [
    TASK_TYPES.ASSIGNED_TASK,
    TASK_TYPES.PROJECT_TASK,
  ],

  // Default values
  DEFAULT_USER_ROLE: USER_ROLES.USER,
  DEFAULT_USER_STATUS: USER_STATUS.OFFLINE,
  DEFAULT_TASK_STATUS: TASK_STATUS.TO_DO,
  DEFAULT_TASK_PRIORITY: TASK_PRIORITY.MEDIUM,
  DEFAULT_TASK_FREQUENCY: TASK_FREQUENCY.DAILY,
  DEFAULT_NOTIFICATION_STATUS: NOTIFICATION_STATUS.UNREAD,
  DEFAULT_PAGE_SIZE: VALIDATION_LIMITS.PAGE_SIZE_DEFAULT,
};

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
};

// Error Codes
export const ERROR_CODES = {
  // Authentication errors
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_INVALID: "TOKEN_INVALID",
  REFRESH_TOKEN_EXPIRED: "REFRESH_TOKEN_EXPIRED",

  // Authorization errors
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",
  ORGANIZATION_MISMATCH: "ORGANIZATION_MISMATCH",
  DEPARTMENT_MISMATCH: "DEPARTMENT_MISMATCH",

  // Validation errors
  VALIDATION_ERROR: "VALIDATION_ERROR",
  DUPLICATE_ENTRY: "DUPLICATE_ENTRY",
  INVALID_OBJECT_ID: "INVALID_OBJECT_ID",
  INVALID_ENUM_VALUE: "INVALID_ENUM_VALUE",

  // Business rule errors
  INVALID_ROUTINE_TASK_STATUS: "INVALID_ROUTINE_TASK_STATUS",
  INVALID_ROUTINE_TASK_PRIORITY: "INVALID_ROUTINE_TASK_PRIORITY",
  HOD_POSITION_CONFLICT: "HOD_POSITION_CONFLICT",
  DEPARTMENT_HAS_USERS: "DEPARTMENT_HAS_USERS",
  ORGANIZATION_HAS_DEPARTMENTS: "ORGANIZATION_HAS_DEPARTMENTS",

  // File upload errors
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  INVALID_FILE_TYPE: "INVALID_FILE_TYPE",
  UPLOAD_FAILED: "UPLOAD_FAILED",

  // Resource errors
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  RESOURCE_DELETED: "RESOURCE_DELETED",
  RESOURCE_CONFLICT: "RESOURCE_CONFLICT",
};

// Regular Expressions
export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^[\+]?[1-9][\d]{0,15}$/,
  URL: /^https?:\/\/.+/,
  OBJECT_ID: /^[0-9a-fA-F]{24}$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
  ALPHANUMERIC: /^[a-zA-Z0-9\s]+$/,
  ALPHANUMERIC_WITH_SPECIAL: /^[a-zA-Z0-9\s\-_.,!@#$%^&*()]+$/,
};

// Socket.IO Events
export const SOCKET_EVENTS = {
  // Connection events
  CONNECTION: "connection",
  DISCONNECT: "disconnect",
  RECONNECT: "reconnect",

  // Authentication events
  AUTHENTICATE: "authenticate",
  AUTHENTICATION_SUCCESS: "authentication_success",
  AUTHENTICATION_FAILED: "authentication_failed",

  // User status events
  USER_STATUS_UPDATE: "user_status_update",
  USER_ONLINE: "user_online",
  USER_OFFLINE: "user_offline",
  USER_AWAY: "user_away",

  // Task events
  TASK_CREATED: "task_created",
  TASK_UPDATED: "task_updated",
  TASK_DELETED: "task_deleted",
  TASK_ASSIGNED: "task_assigned",
  TASK_COMPLETED: "task_completed",

  // Activity events
  ACTIVITY_ADDED: "activity_added",
  ACTIVITY_UPDATED: "activity_updated",

  // Comment events
  COMMENT_ADDED: "comment_added",
  COMMENT_UPDATED: "comment_updated",
  COMMENT_DELETED: "comment_deleted",

  // Notification events
  NOTIFICATION_CREATED: "notification_created",
  NOTIFICATION_READ: "notification_read",

  // Room events
  JOIN_ROOM: "join_room",
  LEAVE_ROOM: "leave_room",
};

// Default export with all constants
export default {
  PLATFORM_FIELDS,
  USER_ROLES,
  USER_ROLES_ARRAY,
  USER_STATUS,
  USER_STATUS_ARRAY,
  ORGANIZATION_SIZES,
  ORGANIZATION_SIZES_ARRAY,
  TASK_STATUS,
  TASK_STATUS_ARRAY,
  TASK_PRIORITY,
  TASK_PRIORITY_ARRAY,
  TASK_TYPES,
  TASK_TYPES_ARRAY,
  TASK_FREQUENCY,
  TASK_FREQUENCY_ARRAY,
  TASK_ACTIVITY_STATUS,
  TASK_ACTIVITY_STATUS_ARRAY,
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPES_ARRAY,
  NOTIFICATION_STATUS,
  NOTIFICATION_STATUS_ARRAY,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_PRIORITY_ARRAY,
  ATTACHMENT_TYPES,
  ATTACHMENT_TYPES_ARRAY,
  ATTACHMENT_MODELS,
  ATTACHMENT_MODELS_ARRAY,
  VALIDATION_LIMITS,
  FILE_UPLOAD,
  ALLOWED_FILE_TYPES,
  BUSINESS_RULES,
  HTTP_STATUS,
  ERROR_CODES,
  REGEX_PATTERNS,
  SOCKET_EVENTS,
};

/**
 * Validation Middleware
 * Centralized validation middleware using express-validator
 */

import { validationResult, matchedData } from "express-validator";
import mongoose from "mongoose";
import CustomError from "../utils/CustomError.js";
import {
  HTTP_STATUS,
  ERROR_CODES,
  REGEX_PATTERNS,
  VALIDATION_LIMITS,
  USER_ROLES_ARRAY,
  USER_STATUS_ARRAY,
  ORGANIZATION_SIZES_ARRAY,
  TASK_STATUS_ARRAY,
  TASK_PRIORITY_ARRAY,
  TASK_TYPES_ARRAY,
  TASK_FREQUENCY_ARRAY,
  NOTIFICATION_TYPES_ARRAY,
  NOTIFICATION_STATUS_ARRAY,
  ATTACHMENT_TYPES_ARRAY,
  ATTACHMENT_MODELS_ARRAY,
  ALLOWED_FILE_TYPES,
} from "../constants/index.js";
import { isFuture } from "../utils/timezoneUtils.js";

/**
 * Main validation middleware that processes validation results
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((error) => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
      location: error.location,
    }));

    const errorMessage = `Validation failed: ${formattedErrors
      .map((e) => e.message)
      .join(", ")}`;

    const validationError = new CustomError(
      errorMessage,
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.VALIDATION_ERROR
    );
    validationError.details = formattedErrors;

    return next(validationError);
  }

  // Store validated data in req.validatedData for use in controllers
  req.validatedData = matchedData(req);
  next();
};

/**
 * Custom validator to check if value is a valid MongoDB ObjectId
 * @param {string} value - The value to validate
 * @returns {boolean} - True if valid ObjectId, false otherwise
 */
export const isValidObjectId = (value) => {
  if (!value) return false;
  return (
    mongoose.Types.ObjectId.isValid(value) &&
    REGEX_PATTERNS.OBJECT_ID.test(value)
  );
};

/**
 * Custom validator to check if ObjectId exists in a collection
 * @param {string} model - The mongoose model name
 * @param {string} field - The field to check (default: '_id')
 * @param {Object} additionalConditions - Additional query conditions
 * @returns {Function} - Validator function
 */
export const objectIdExists = (
  model,
  field = "_id",
  additionalConditions = {}
) => {
  return async (value) => {
    if (!isValidObjectId(value)) {
      throw new Error(`Invalid ObjectId format`);
    }

    const Model = mongoose.model(model);
    const query = { [field]: value, ...additionalConditions };
    const exists = await Model.findOne(query);

    if (!exists) {
      throw new Error(`${model} not found`);
    }

    return true;
  };
};

/**
 * Custom validator to check if ObjectId exists within user's organization
 * @param {string} model - The mongoose model name
 * @param {string} field - The field to check (default: '_id')
 * @returns {Function} - Validator function
 */
export const objectIdExistsInOrganization = (model, field = "_id") => {
  return async (value, { req }) => {
    if (!isValidObjectId(value)) {
      throw new Error(`Invalid ObjectId format`);
    }

    if (!req.user || !req.user.organization) {
      throw new Error("User organization not found");
    }

    const Model = mongoose.model(model);
    const query = {
      [field]: value,
      organization: req.user.organization._id,
    };
    const exists = await Model.findOne(query);

    if (!exists) {
      throw new Error(`${model} not found in your organization`);
    }

    return true;
  };
};

/**
 * Custom validator to check if ObjectId exists within user's department
 * @param {string} model - The mongoose model name
 * @param {string} field - The field to check (default: '_id')
 * @returns {Function} - Validator function
 */
export const objectIdExistsInDepartment = (model, field = "_id") => {
  return async (value, { req }) => {
    if (!isValidObjectId(value)) {
      throw new Error(`Invalid ObjectId format`);
    }

    if (!req.user || !req.user.department) {
      throw new Error("User department not found");
    }

    const Model = mongoose.model(model);
    const query = {
      [field]: value,
      department: req.user.department._id,
    };
    const exists = await Model.findOne(query);

    if (!exists) {
      throw new Error(`${model} not found in your department`);
    }

    return true;
  };
};

/**
 * Custom validator for enum values
 * @param {Array} allowedValues - Array of allowed enum values
 * @param {string} fieldName - Name of the field for error messages
 * @returns {Function} - Validator function
 */
export const isValidEnum = (allowedValues, fieldName) => {
  return (value) => {
    if (!allowedValues.includes(value)) {
      throw new Error(
        `${fieldName} must be one of: ${allowedValues.join(", ")}`
      );
    }
    return true;
  };
};

/**
 * Custom validator for array of enum values
 * @param {Array} allowedValues - Array of allowed enum values
 * @param {string} fieldName - Name of the field for error messages
 * @returns {Function} - Validator function
 */
export const isValidEnumArray = (allowedValues, fieldName) => {
  return (values) => {
    if (!Array.isArray(values)) {
      throw new Error(`${fieldName} must be an array`);
    }

    const invalidValues = values.filter(
      (value) => !allowedValues.includes(value)
    );
    if (invalidValues.length > 0) {
      throw new Error(
        `${fieldName} contains invalid values: ${invalidValues.join(
          ", "
        )}. Allowed values: ${allowedValues.join(", ")}`
      );
    }

    return true;
  };
};

/**
 * Custom validator for array of ObjectIds
 * @param {string} model - The mongoose model name
 * @param {Object} additionalConditions - Additional query conditions
 * @returns {Function} - Validator function
 */
export const isValidObjectIdArray = (model, additionalConditions = {}) => {
  return async (values) => {
    if (!Array.isArray(values)) {
      throw new Error("Must be an array");
    }

    if (values.length === 0) {
      throw new Error("Array cannot be empty");
    }

    // Check if all values are valid ObjectIds
    const invalidIds = values.filter((value) => !isValidObjectId(value));
    if (invalidIds.length > 0) {
      throw new Error(`Invalid ObjectId format: ${invalidIds.join(", ")}`);
    }

    // Check if all ObjectIds exist in the database
    const Model = mongoose.model(model);
    const query = {
      _id: { $in: values },
      ...additionalConditions,
    };
    const existingDocs = await Model.find(query).select("_id");
    const existingIds = existingDocs.map((doc) => doc._id.toString());

    const nonExistentIds = values.filter((id) => !existingIds.includes(id));
    if (nonExistentIds.length > 0) {
      throw new Error(`${model} not found: ${nonExistentIds.join(", ")}`);
    }

    return true;
  };
};

/**
 * Custom validator for array of ObjectIds within user's organization
 * @param {string} model - The mongoose model name
 * @returns {Function} - Validator function
 */
export const isValidObjectIdArrayInOrganization = (model) => {
  return async (values, { req }) => {
    if (!Array.isArray(values)) {
      throw new Error("Must be an array");
    }

    if (values.length === 0) {
      throw new Error("Array cannot be empty");
    }

    if (!req.user || !req.user.organization) {
      throw new Error("User organization not found");
    }

    // Check if all values are valid ObjectIds
    const invalidIds = values.filter((value) => !isValidObjectId(value));
    if (invalidIds.length > 0) {
      throw new Error(`Invalid ObjectId format: ${invalidIds.join(", ")}`);
    }

    // Check if all ObjectIds exist in user's organization
    const Model = mongoose.model(model);
    const query = {
      _id: { $in: values },
      organization: req.user.organization._id,
    };
    const existingDocs = await Model.find(query).select("_id");
    const existingIds = existingDocs.map((doc) => doc._id.toString());

    const nonExistentIds = values.filter((id) => !existingIds.includes(id));
    if (nonExistentIds.length > 0) {
      throw new Error(
        `${model} not found in your organization: ${nonExistentIds.join(", ")}`
      );
    }

    return true;
  };
};

/**
 * Custom validator to check if ObjectId exists including soft deleted records
 * @param {string} model - The mongoose model name
 * @param {string} field - The field to check (default: '_id')
 * @returns {Function} - Validator function
 */
export const objectIdExistsWithDeleted = (model, field = "_id") => {
  return async (value, { req }) => {
    if (!isValidObjectId(value)) {
      throw new Error(`Invalid ObjectId format`);
    }

    if (!req.user || !req.user.organization) {
      throw new Error("User organization not found");
    }

    const Model = mongoose.model(model);
    const query = {
      [field]: value,
      organization: req.user.organization._id,
    };
    const exists = await Model.findOne(query).withDeleted();

    if (!exists) {
      throw new Error(`${model} not found in your organization`);
    }

    return true;
  };
};

/**
 * Custom validator to check if ObjectId exists and is soft deleted
 * @param {string} model - The mongoose model name
 * @param {string} field - The field to check (default: '_id')
 * @returns {Function} - Validator function
 */
export const objectIdExistsAndDeleted = (model, field = "_id") => {
  return async (value, { req }) => {
    if (!isValidObjectId(value)) {
      throw new Error(`Invalid ObjectId format`);
    }

    if (!req.user || !req.user.organization) {
      throw new Error("User organization not found");
    }

    const Model = mongoose.model(model);
    const query = {
      [field]: value,
      organization: req.user.organization._id,
    };
    const exists = await Model.findOne(query).onlyDeleted();

    if (!exists) {
      throw new Error(`${model} not found or not deleted in your organization`);
    }

    return true;
  };
};

/**
 * Custom validator for unique field within organization
 * @param {string} model - The mongoose model name
 * @param {string} field - The field to check for uniqueness
 * @param {string} excludeId - ObjectId to exclude from uniqueness check (for updates)
 * @returns {Function} - Validator function
 */
export const isUniqueInOrganization = (model, field, excludeId = null) => {
  return async (value, { req }) => {
    if (!req.user || !req.user.organization) {
      throw new Error("User organization not found");
    }

    const Model = mongoose.model(model);
    const query = {
      [field]: value,
      organization: req.user.organization._id,
    };

    // Exclude current document from uniqueness check (for updates)
    if (excludeId && isValidObjectId(excludeId)) {
      query._id = { $ne: excludeId };
    } else if (req.params) {
      // Check for any ID parameter in params and use it for exclusion
      const idParam = Object.keys(req.params).find(
        (key) => key.endsWith("Id") && isValidObjectId(req.params[key])
      );
      if (idParam) {
        query._id = { $ne: req.params[idParam] };
      }
    }

    const existing = await Model.findOne(query);
    if (existing) {
      throw new Error(`${field} already exists in your organization`);
    }

    return true;
  };
};

/**
 * Custom validator for unique field within department
 * @param {string} model - The mongoose model name
 * @param {string} field - The field to check for uniqueness
 * @param {string} excludeId - ObjectId to exclude from uniqueness check (for updates)
 * @returns {Function} - Validator function
 */
export const isUniqueInDepartment = (model, field, excludeId = null) => {
  return async (value, { req }) => {
    if (!req.user || !req.user.department) {
      throw new Error("User department not found");
    }

    const Model = mongoose.model(model);
    const query = {
      [field]: value,
      department: req.user.department._id,
    };

    // Exclude current document from uniqueness check (for updates)
    if (excludeId && isValidObjectId(excludeId)) {
      query._id = { $ne: excludeId };
    } else if (req.params) {
      // Check for any ID parameter in params and use it for exclusion
      const idParam = Object.keys(req.params).find(
        (key) => key.endsWith("Id") && isValidObjectId(req.params[key])
      );
      if (idParam) {
        query._id = { $ne: req.params[idParam] };
      }
    }

    const existing = await Model.findOne(query);
    if (existing) {
      throw new Error(`${field} already exists in your department`);
    }

    return true;
  };
};

/**
 * Custom validator for password strength
 * @param {string} value - Password to validate
 * @returns {boolean} - True if password meets requirements
 */
export const isStrongPassword = (value) => {
  // Use regex pattern from constants
  if (!REGEX_PATTERNS.PASSWORD.test(value)) {
    throw new Error(
      `Password must be at least ${VALIDATION_LIMITS.PASSWORD_MIN} characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character`
    );
  }

  return true;
};

/**
 * Custom validator for future date
 * @param {string|Date} value - Date to validate
 * @returns {boolean} - True if date is in the future
 */
export const isFutureDate = (value) => {
  if (!isFuture(value)) {
    throw new Error("Date must be in the future");
  }

  return true;
};

/**
 * Custom validator for file type
 * @param {string} mimetype - File mimetype to validate
 * @returns {boolean} - True if file type is allowed
 */
export const isAllowedFileType = (mimetype) => {
  if (!ALLOWED_FILE_TYPES.includes(mimetype)) {
    throw new Error(
      `File type not allowed. Allowed types: ${ALLOWED_FILE_TYPES.join(", ")}`
    );
  }

  return true;
};

/**
 * Custom validator for file size
 * @param {number} size - File size in bytes
 * @param {number} maxSize - Maximum allowed size in bytes
 * @returns {boolean} - True if file size is within limit
 */
export const isValidFileSize = (size, maxSize) => {
  if (size > maxSize) {
    throw new Error(
      `File size exceeds maximum allowed size of ${Math.round(
        maxSize / (1024 * 1024)
      )}MB`
    );
  }

  return true;
};

// Export pre-configured enum validators for common use
export const validators = {
  userRole: isValidEnum(USER_ROLES_ARRAY, "Role"),
  userStatus: isValidEnum(USER_STATUS_ARRAY, "Status"),
  organizationSize: isValidEnum(ORGANIZATION_SIZES_ARRAY, "Organization size"),
  taskStatus: isValidEnum(TASK_STATUS_ARRAY, "Task status"),
  taskPriority: isValidEnum(TASK_PRIORITY_ARRAY, "Task priority"),
  taskType: isValidEnum(TASK_TYPES_ARRAY, "Task type"),
  taskFrequency: isValidEnum(TASK_FREQUENCY_ARRAY, "Task frequency"),
  notificationType: isValidEnum(NOTIFICATION_TYPES_ARRAY, "Notification type"),
  notificationStatus: isValidEnum(
    NOTIFICATION_STATUS_ARRAY,
    "Notification status"
  ),
  attachmentType: isValidEnum(ATTACHMENT_TYPES_ARRAY, "Attachment type"),
  attachmentModel: isValidEnum(ATTACHMENT_MODELS_ARRAY, "Attachment model"),
};

// Alias for backward compatibility
export const validateRequest = handleValidationErrors;

export default {
  handleValidationErrors,
  validateRequest,
  isValidObjectId,
  objectIdExists,
  objectIdExistsInOrganization,
  objectIdExistsInDepartment,
  objectIdExistsWithDeleted,
  objectIdExistsAndDeleted,
  isValidEnum,
  isValidEnumArray,
  isValidObjectIdArray,
  isValidObjectIdArrayInOrganization,
  isUniqueInOrganization,
  isUniqueInDepartment,
  isStrongPassword,
  isFutureDate,
  isAllowedFileType,
  isValidFileSize,
  validators,
};

/**
 * Controller Helper Functions
 * Standardized patterns for tenant and caller identification
 */

import { USER_ROLES } from "../constants/index.js";

/**
 * Extract standardized user context from authenticated request
 * Use this pattern consistently across all controllers
 * @param {Object} req - Express request object with authenticated user
 * @returns {Object} Standardized user context
 */
export const extractUserContext = (req) => {
  if (!req.user) {
    throw new Error("User not authenticated");
  }

  return {
    // Tenant identification - use these for scoping operations
    orgId: req.user.organization._id,
    deptId: req.user.department._id,

    // Caller identification - use for audit trails and permissions
    callerId: req.user._id,

    // User details for convenience
    userRole: req.user.role,
    isPlatformAdmin:
      req.user.isPlatformUser &&
      req.user.organization.isPlatformOrg &&
      [USER_ROLES.SUPER_ADMIN].includes(req.user.role),

    // New boolean field access for convenience
    isPlatformOrg: req.user.organization.isPlatformOrg,
    isPlatformUser: req.user.isPlatformUser,
    isHodUser: req.user.isHod,
  };
};

/**
 * Extract resource identifiers from request parameters
 * Only use when strictly required for resource identification
 * @param {Object} req - Express request object
 * @param {Array} paramNames - Array of parameter names to extract
 * @returns {Object} Extracted parameters
 */
export const extractResourceIds = (req, paramNames = []) => {
  const resourceIds = {};

  paramNames.forEach((paramName) => {
    if (req.params[paramName]) {
      resourceIds[paramName] = req.params[paramName];
    }
  });

  return resourceIds;
};

/**
 * Example usage in controllers:
 *
 * export const someController = asyncHandler(async (req, res, next) => {
 *   // Standard pattern for tenant and caller identification
 *   const { orgId, deptId, callerId, userRole, isHod } = extractUserContext(req);
 *
 *   // Only extract from parameters when needed for resource identification
 *   const { departmentId, userId, taskId } = extractResourceIds(req, ['departmentId', 'userId', 'taskId']);
 *
 *   // Use orgId, deptId, callerId for all operations
 *   const tasks = await Task.find({ organization: orgId, department: deptId });
 *
 *   // Use extracted resource IDs only when needed
 *   if (taskId) {
 *     const task = await Task.findById(taskId);
 *   }
 * });
 */

/**
 * Create standardized pagination options for mongoose-paginate-v2
 * @param {Object} req - Express request object
 * @param {Object} defaultOptions - Default pagination options
 * @returns {Object} Pagination options
 */
export const createPaginationOptions = (req, defaultOptions = {}) => {
  const {
    page = 1,
    limit = 20,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.validatedData;

  // Build sort object
  const sortOptions = {};
  const sortDirection = sortOrder === "asc" || sortOrder === "1" ? 1 : -1;
  sortOptions[sortBy] = sortDirection;

  return {
    page: parseInt(page),
    limit: Math.min(parseInt(limit), 100), // Cap at 100 items per page
    sort: sortOptions,
    lean: true,
    ...defaultOptions,
  };
};

/**
 * Create standardized pagination response format
 * @param {Object} paginateResult - Result from mongoose-paginate-v2
 * @param {Array} docs - Documents (if different from paginateResult.docs)
 * @returns {Object} Standardized response format
 */
export const createPaginationResponse = (paginateResult, docs = null) => {
  return {
    docs: docs || paginateResult.docs,
    pagination: {
      page: paginateResult.page,
      limit: paginateResult.limit,
      totalPages: paginateResult.totalPages,
      totalCount: paginateResult.totalDocs,
      hasNextPage: paginateResult.hasNextPage,
      hasPrevPage: paginateResult.hasPrevPage,
      nextPage: paginateResult.nextPage,
      prevPage: paginateResult.prevPage,
    },
  };
};

/**
 * Create standardized success response format
 * @param {*} data - Response data
 * @param {string} message - Success message
 * @param {Object} meta - Additional metadata
 * @returns {Object} Standardized success response
 */
export const createSuccessResponse = (data, message = "Success", meta = {}) => {
  return {
    success: true,
    message,
    data,
    ...meta,
    timestamp: new Date().toISOString(),
  };
};

/**
 * Create standardized error response format
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @param {Array} details - Error details
 * @param {Object} meta - Additional metadata
 * @returns {Object} Standardized error response
 */
export const createErrorResponse = (
  message,
  code = null,
  details = [],
  meta = {}
) => {
  return {
    success: false,
    error: {
      message,
      code,
      details,
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
};

/**
 * Create filtering options for database queries
 * @param {Object} req - Express request object
 * @param {Array} allowedFields - Fields allowed for filtering
 * @returns {Object} Filter object for database query
 */
export const createFilterOptions = (req, allowedFields = []) => {
  const { orgId, deptId } = extractUserContext(req);
  const filters = {
    organization: orgId,
    department: deptId,
    isDeleted: { $ne: true }, // Always exclude soft deleted records
  };

  // Add user-provided filters for allowed fields
  if (req.validatedData) {
    allowedFields.forEach((field) => {
      if (req.validatedData[field] !== undefined) {
        filters[field] = req.validatedData[field];
      }
    });
  }

  return filters;
};

/**
 * Create search options for text-based queries
 * @param {Object} req - Express request object
 * @param {Array} searchFields - Fields to search in
 * @returns {Object} Search filter object
 */
export const createSearchOptions = (req, searchFields = []) => {
  const { search } = req.validatedData || {};

  if (!search || searchFields.length === 0) {
    return {};
  }

  {
    $or: searchFields.map((field) => ({
      [field]: { $regex: search, $options: "i" },
    }));
  }
};

/**
 * Combine filters and search options
 * @param {Object} filters - Base filters
 * @param {Object} searchOptions - Search options
 * @returns {Object} Combined query object
 */
export const combineQueryOptions = (filters, searchOptions) => {
  if (Object.keys(searchOptions).length === 0) {
    return filters;
  }

  return {
    ...filters,
    ...searchOptions,
  };
};
export default {
  extractUserContext,
  extractResourceIds,
  createPaginationOptions,
  createPaginationResponse,
  createSuccessResponse,
  createErrorResponse,
  createFilterOptions,
  createSearchOptions,
  combineQueryOptions,
};

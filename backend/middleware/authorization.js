import CustomError from "../utils/CustomError.js";

/**
 * Authorization Middleware
 * Implements role-based access control with multi-level scoping
 * Supports: own, ownDept, crossDept, crossOrg scoping levels
 */

// Authorization Matrix Configuration
// Defines what each role can access at different scope levels
const AUTHORIZATION_MATRIX = {
  // SuperAdmin: Full organization access + platform management
  SuperAdmin: {
    own: ["read", "write", "delete"],
    ownDept: ["read", "write", "delete"],
    crossDept: ["read", "write", "delete"],
    crossOrg: ["read", "write", "delete"], // Only for platform SuperAdmins
    resources: {
      users: ["create", "read", "update", "delete", "restore"],
      departments: ["create", "read", "update", "delete", "restore"],
      organizations: ["create", "read", "update", "delete", "restore"], // Platform only
      tasks: ["create", "read", "update", "delete", "restore"],
      materials: ["create", "read", "update", "delete", "restore"],
      vendors: ["create", "read", "update", "delete", "restore"],
      notifications: ["read", "update", "delete"],
      attachments: ["create", "read", "delete"],
    },
  },

  // Admin: Department head with cross-department read access
  Admin: {
    own: ["read", "write", "delete"],
    ownDept: ["read", "write", "delete"],
    crossDept: ["read"], // Can view other departments in same org
    crossOrg: [], // No cross-organization access
    resources: {
      users: ["create", "read", "update", "delete"], // Within department
      departments: ["read"], // Can view all departments in org
      organizations: ["read"], // Can view own organization only
      tasks: ["create", "read", "update", "delete"],
      materials: ["create", "read", "update", "delete"],
      vendors: ["create", "read", "update", "delete"],
      notifications: ["read", "update", "delete"],
      attachments: ["create", "read", "delete"],
    },
  },

  // Manager: Assistant department head with limited cross-department access
  Manager: {
    own: ["read", "write", "delete"],
    ownDept: ["read", "write"],
    crossDept: ["read"], // Limited read access to other departments
    crossOrg: [], // No cross-organization access
    resources: {
      users: ["read", "update"], // Can view and update users in department
      departments: ["read"], // Can view departments in org
      organizations: ["read"], // Can view own organization
      tasks: ["create", "read", "update", "delete"],
      materials: ["create", "read", "update"],
      vendors: ["read", "update"],
      notifications: ["read", "update"],
      attachments: ["create", "read", "delete"],
    },
  },

  // User: Regular employee with own data and department task access
  User: {
    own: ["read", "write"],
    ownDept: ["read"], // Can view department data
    crossDept: [], // No cross-department access
    crossOrg: [], // No cross-organization access
    resources: {
      users: ["read"], // Can view users in department
      departments: ["read"], // Can view own department
      organizations: ["read"], // Can view own organization
      tasks: ["create", "read", "update"], // Can manage assigned tasks
      materials: ["read"],
      vendors: ["read"],
      notifications: ["read", "update"],
      attachments: ["create", "read"],
    },
  },
};

/**
 * Determine the scope level between the requesting user and target resource
 * @param {Object} user - Requesting user object
 * @param {Object} targetResource - Target resource object
 * @param {string} resourceType - Type of resource (user, task, etc.)
 * @returns {string} Scope level: 'own', 'ownDept', 'crossDept', 'crossOrg'
 */
const determineScopeLevel = (user, targetResource, resourceType) => {
  // Handle different resource structures
  let targetUserId, targetOrgId, targetDeptId;

  if (resourceType === "user") {
    targetUserId = targetResource._id?.toString() || targetResource.toString();
    targetOrgId =
      targetResource.organization?._id?.toString() ||
      targetResource.organization?.toString();
    targetDeptId =
      targetResource.department?._id?.toString() ||
      targetResource.department?.toString();
  } else if (resourceType === "organization") {
    targetOrgId = targetResource._id?.toString() || targetResource.toString();
  } else if (resourceType === "department") {
    targetOrgId =
      targetResource.organization?._id?.toString() ||
      targetResource.organization?.toString();
    targetDeptId = targetResource._id?.toString() || targetResource.toString();
  } else {
    // For tasks, materials, vendors, etc.
    targetOrgId =
      targetResource.organization?._id?.toString() ||
      targetResource.organization?.toString();
    targetDeptId =
      targetResource.department?._id?.toString() ||
      targetResource.department?.toString();
    targetUserId =
      targetResource.createdBy?._id?.toString() ||
      targetResource.createdBy?.toString();
  }

  const userOrgId = user.organization._id.toString();
  const userDeptId = user.department._id.toString();
  const userId = user._id.toString();

  // Check if user is platform admin
  const isPlatformAdmin =
    req.user.isPlatformUser || req.user.organization.isPlatformOrg;

  // Own resource (user owns the resource)
  if (targetUserId && targetUserId === userId) {
    return "own";
  }

  // Cross-organization access (only for platform admins)
  if (targetOrgId && targetOrgId !== userOrgId) {
    return isPlatformAdmin ? "crossOrg" : null;
  }

  // Same organization, different department
  if (targetDeptId && targetDeptId !== userDeptId) {
    return "crossDept";
  }

  // Same department
  if (targetDeptId && targetDeptId === userDeptId) {
    return "ownDept";
  }

  // Same organization (for organization-level resources)
  if (targetOrgId && targetOrgId === userOrgId) {
    return "ownDept"; // Treat organization-level as department level
  }

  return null; // No valid scope determined
};

/**
 * Check if user has permission for a specific action on a resource
 * @param {Object} user - User object with role information
 * @param {string} action - Action to perform (read, write, delete, etc.)
 * @param {string} resource - Resource type (users, tasks, etc.)
 * @param {Object} targetResource - Target resource object (optional)
 * @param {string} resourceType - Type of resource for scope determination
 * @returns {boolean} True if user has permission
 */
const hasPermission = (
  user,
  action,
  resource,
  targetResource = null,
  resourceType = null
) => {
  const userRole = user.role;
  const rolePermissions = AUTHORIZATION_MATRIX[userRole];

  if (!rolePermissions) {
    return false;
  }

  // Check resource-specific permissions
  const resourcePermissions = rolePermissions.resources[resource];
  if (!resourcePermissions || !resourcePermissions.includes(action)) {
    return false;
  }

  // If no target resource provided, check general resource access
  if (!targetResource) {
    return true;
  }

  // Determine scope level
  const scopeLevel = determineScopeLevel(
    user,
    targetResource,
    resourceType || resource
  );

  if (!scopeLevel) {
    return false; // No valid scope
  }

  // Check if user has permission at this scope level
  const scopePermissions = rolePermissions[scopeLevel];

  // Map actions to scope permissions
  const actionScopeMap = {
    create: "write",
    read: "read",
    update: "write",
    delete: "delete",
    restore: "write",
  };

  const requiredScopePermission = actionScopeMap[action] || action;
  return scopePermissions.includes(requiredScopePermission);
};

/**
 * Authorization middleware factory
 * Creates middleware that checks permissions for specific actions and resources
 * @param {string} action - Required action (read, write, delete, etc.)
 * @param {string} resource - Required resource (users, tasks, etc.)
 * @param {Object} options - Additional options
 * @returns {Function} Express middleware function
 */
export const authorize = (action, resource, options = {}) => {
  return (req, res, next) => {
    if (!req.user) {
      throw CustomError.unauthorized(
        "Authentication required for authorization check."
      );
    }

    const {
      getTargetResource = null,
      resourceType = null,
      allowSelf = false,
    } = options;

    try {
      let targetResource = null;

      // Get target resource if function provided
      if (getTargetResource && typeof getTargetResource === "function") {
        targetResource = getTargetResource(req);
      }

      // Special case: allow users to access their own data
      if (allowSelf && req.params.id === req.user._id.toString()) {
        return next();
      }

      // Check permission
      const hasAccess = hasPermission(
        req.user,
        action,
        resource,
        targetResource,
        resourceType
      );

      if (!hasAccess) {
        throw CustomError.forbidden(
          `Insufficient permissions to ${action} ${resource}.`
        );
      }

      next();
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      console.error("Authorization error:", error);
      throw CustomError.forbidden("Authorization check failed.");
    }
  };
};

/**
 * Role-based authorization middleware
 * Checks if user has one of the required roles
 * @param {string|Array} requiredRoles - Required role(s)
 * @returns {Function} Express middleware function
 */
export const requireRole = (requiredRoles) => {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

  return (req, res, next) => {
    if (!req.user) {
      throw CustomError.unauthorized("Authentication required for role check.");
    }

    if (!roles.includes(req.user.role)) {
      throw CustomError.forbidden(
        `Access denied. Required role(s): ${roles.join(", ")}`
      );
    }

    next();
  };
};

/**
 * HOD (Head of Department) authorization middleware
 * Checks if user is SuperAdmin or Admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const requireHOD = (req, res, next) => {
  if (!req.user) {
    throw CustomError.unauthorized("Authentication required.");
  }

  if (!["SuperAdmin", "Admin"].includes(req.user.role)) {
    throw CustomError.forbidden(
      "Head of Department access required (SuperAdmin or Admin role)."
    );
  }

  next();
};

/**
 * Organization scope middleware
 * Ensures operations are scoped to user's organization
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const requireOrganizationScope = (req, res, next) => {
  if (!req.user) {
    throw CustomError.unauthorized("Authentication required.");
  }

  // Add organization filter to query/body
  const userOrgId = req.user.organization._id.toString();

  // Add to query filters
  if (req.query) {
    req.query.organization = userOrgId;
  }

  // Add to request body for creation
  if (req.body && req.method === "POST") {
    req.body.organization = userOrgId;
  }

  // Store in request for use in controllers
  req.organizationId = userOrgId;

  next();
};

/**
 * Department scope middleware
 * Ensures operations are scoped to user's department (for non-HODs)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const requireDepartmentScope = (req, res, next) => {
  if (!req.user) {
    throw CustomError.unauthorized("Authentication required.");
  }

  const userDeptId = req.user.department._id.toString();
  const isHOD = ["SuperAdmin", "Admin"].includes(req.user.role);

  // HODs can access cross-department data, regular users cannot
  if (!isHOD) {
    // Add department filter to query
    if (req.query) {
      req.query.department = userDeptId;
    }

    // Add to request body for creation
    if (req.body && req.method === "POST") {
      req.body.department = userDeptId;
    }
  }

  // Store in request for use in controllers
  req.departmentId = userDeptId;
  req.isHOD = isHOD;

  next();
};

/**
 * Resource ownership middleware
 * Checks if user owns the resource or has appropriate permissions
 * @param {string} resourceModel - Mongoose model name
 * @param {string} paramName - Parameter name containing resource ID
 * @returns {Function} Express middleware function
 */
export const requireResourceOwnership = (resourceModel, paramName = "id") => {
  return async (req, res, next) => {
    if (!req.user) {
      throw CustomError.unauthorized("Authentication required.");
    }

    try {
      const resourceId = req.params[paramName];
      if (!resourceId) {
        throw CustomError.badRequest(`${paramName} parameter is required.`);
      }

      // This would need to be implemented with actual model imports
      // For now, we'll store the requirement in the request
      req.resourceOwnershipCheck = {
        model: resourceModel,
        id: resourceId,
        user: req.user,
      };

      next();
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      throw CustomError.internalServer("Resource ownership check failed.");
    }
  };
};

export default {
  authorize,
  requireRole,
  requireHOD,
  requireOrganizationScope,
  requireDepartmentScope,
  requireResourceOwnership,
  hasPermission,
  determineScopeLevel,
  AUTHORIZATION_MATRIX,
};

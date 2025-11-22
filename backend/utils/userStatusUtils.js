import User from "../models/User.js";
import CustomError from "./CustomError.js";

/**
 * User Status Tracking Utilities
 * Manages online/offline/away status with broadcasting functionality
 * Integrates with Socket.IO for real-time status updates
 */

// Status constants
export const USER_STATUS = {
  ONLINE: "online",
  OFFLINE: "offline",
  AWAY: "away",
};

// Status transition rules
const VALID_STATUS_TRANSITIONS = {
  [USER_STATUS.OFFLINE]: [USER_STATUS.ONLINE],
  [USER_STATUS.ONLINE]: [USER_STATUS.AWAY, USER_STATUS.OFFLINE],
  [USER_STATUS.AWAY]: [USER_STATUS.ONLINE, USER_STATUS.OFFLINE],
};

// Auto-away timeout (15 minutes of inactivity)
const AUTO_AWAY_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds

// User activity tracking
const userActivityMap = new Map();

/**
 * Update user status in database
 * @param {string} userId - User ID
 * @param {string} status - New status (online, offline, away)
 * @param {Object} socketIO - Socket.IO instance for broadcasting (optional)
 * @returns {Promise<Object>} Updated user object
 */
export const updateUserStatus = async (userId, status, socketIO = null) => {
  try {
    // Validate status
    if (!Object.values(USER_STATUS).includes(status)) {
      throw CustomError.badRequest(
        `Invalid status: ${status}. Must be one of: ${Object.values(
          USER_STATUS
        ).join(", ")}`
      );
    }

    // Find user and get current status
    const user = await User.findById(userId)
    .populate("organization", "name _id isPlatformOrg isDeleted")
    .populate("department", "name _id isDeleted")
    .select("isPlatformUser isHod isDeleted")

    if (!user) {
      throw CustomError.notFound("User not found");
    }

    if (user.isDeleted) {
      throw CustomError.badRequest("Cannot update status for deleted user");
    }

    const currentStatus = user.status;

    // Check if status transition is valid
    if (
      currentStatus !== status &&
      VALID_STATUS_TRANSITIONS[currentStatus] &&
      !VALID_STATUS_TRANSITIONS[currentStatus].includes(status)
    ) {
      throw CustomError.badRequest(
        `Invalid status transition from ${currentStatus} to ${status}`
      );
    }

    // Update status in database
    user.status = status;
    await user.save();

    // Update activity tracking
    if (status === USER_STATUS.ONLINE) {
      userActivityMap.set(userId, Date.now());
    } else if (status === USER_STATUS.OFFLINE) {
      userActivityMap.delete(userId);
    }

    // Broadcast status change via Socket.IO
    if (socketIO && currentStatus !== status) {
      await broadcastStatusChange(user, status, currentStatus, socketIO);
    }

    return {
      userId: user._id,
      status: user.status,
      previousStatus: currentStatus,
      fullName: user.fullName,
      organization: user.organization,
      department: user.department,
      updatedAt: user.updatedAt,
    };
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }
    console.error("Error updating user status:", error);
    throw CustomError.internalServer("Failed to update user status");
  }
};

/**
 * Get user status
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User status information
 */
export const getUserStatus = async (userId) => {
  try {
    const user = await User.findById(userId)
      .select(
        "status firstName lastName organization department isPlatformUser isHod updatedAt"
      )
      .populate("organization", "name _id")
      .populate("department", "name _id");

    if (!user) {
      throw CustomError.notFound("User not found");
    }

    const lastActivity = userActivityMap.get(userId);

    return {
      userId: user._id,
      status: user.status,
      fullName: user.fullName,
      organization: user.organization,
      department: user.department,
      isPlatformUser: user.isPlatformUser || false,
      isHod: user.isHod || false,
      lastActivity: lastActivity ? new Date(lastActivity) : null,
      updatedAt: user.updatedAt,
    };
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }
    console.error("Error getting user status:", error);
    throw CustomError.internalServer("Failed to get user status");
  }
};

/**
 * Get status of multiple users
 * @param {Array<string>} userIds - Array of user IDs
 * @returns {Promise<Array>} Array of user status objects
 */
export const getMultipleUserStatus = async (userIds) => {
  try {
    const users = await User.find({
      _id: { $in: userIds },
      isDeleted: { $ne: true },
    })
      .select(
        "status firstName lastName organization department isPlatformUser isHod updatedAt"
      )
      .populate("organization", "name _id")
      .populate("department", "name _id");

    return users.map((user) => {
      const lastActivity = userActivityMap.get(user._id.toString());
      return {
        userId: user._id,
        status: user.status,
        fullName: user.fullName,
        organization: user.organization,
        department: user.department,
        isPlatformUser: user.isPlatformUser || false,
        isHod: user.isHod || false,
        lastActivity: lastActivity ? new Date(lastActivity) : null,
        updatedAt: user.updatedAt,
      };
    });
  } catch (error) {
    console.error("Error getting multiple user status:", error);
    throw CustomError.internalServer("Failed to get user status");
  }
};

/**
 * Get online users in organization
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Array>} Array of online users
 */
export const getOnlineUsersInOrganization = async (organizationId) => {
  try {
    const users = await User.find({
      organization: organizationId,
      status: { $in: [USER_STATUS.ONLINE, USER_STATUS.AWAY] },
      isDeleted: { $ne: true },
    })
      .select(
        "status firstName lastName department isPlatformUser isHod updatedAt"
      )
      .populate("department", "name _id");

    return users.map((user) => {
      const lastActivity = userActivityMap.get(user._id.toString());
      return {
        userId: user._id,
        status: user.status,
        fullName: user.fullName,
        department: user.department,
        isPlatformUser: user.isPlatformUser || false,
        isHod: user.isHod || false,
        lastActivity: lastActivity ? new Date(lastActivity) : null,
        updatedAt: user.updatedAt,
      };
    });
  } catch (error) {
    console.error("Error getting online users in organization:", error);
    throw CustomError.internalServer("Failed to get online users");
  }
};

/**
 * Get online users in department
 * @param {string} departmentId - Department ID
 * @returns {Promise<Array>} Array of online users
 */
export const getOnlineUsersInDepartment = async (departmentId) => {
  try {
    const users = await User.find({
      department: departmentId,
      status: { $in: [USER_STATUS.ONLINE, USER_STATUS.AWAY] },
      isDeleted: { $ne: true },
    }).select("status firstName lastName isPlatformUser isHod updatedAt");

    return users.map((user) => {
      const lastActivity = userActivityMap.get(user._id.toString());
      return {
        userId: user._id,
        status: user.status,
        fullName: user.fullName,
        isPlatformUser: user.isPlatformUser || false,
        isHod: user.isHod || false,
        lastActivity: lastActivity ? new Date(lastActivity) : null,
        updatedAt: user.updatedAt,
      };
    });
  } catch (error) {
    console.error("Error getting online users in department:", error);
    throw CustomError.internalServer(
      "Failed to get online users in department"
    );
  }
};

/**
 * Update user activity timestamp
 * @param {string} userId - User ID
 */
export const updateUserActivity = (userId) => {
  if (userActivityMap.has(userId)) {
    userActivityMap.set(userId, Date.now());
  }
};

/**
 * Set user as away due to inactivity
 * @param {string} userId - User ID
 * @param {Object} socketIO - Socket.IO instance for broadcasting
 */
export const setUserAwayDueToInactivity = async (userId, socketIO = null) => {
  try {
    const user = await User.findById(userId);
    if (user && user.status === USER_STATUS.ONLINE) {
      await updateUserStatus(userId, USER_STATUS.AWAY, socketIO);
    }
  } catch (error) {
    console.error("Error setting user away due to inactivity:", error);
  }
};

/**
 * Check for inactive users and set them as away
 * @param {Object} socketIO - Socket.IO instance for broadcasting
 */
export const checkInactiveUsers = async (socketIO = null) => {
  const now = Date.now();
  const inactiveUserIds = [];

  // Find users who have been inactive for more than AUTO_AWAY_TIMEOUT
  for (const [userId, lastActivity] of userActivityMap.entries()) {
    if (now - lastActivity > AUTO_AWAY_TIMEOUT) {
      inactiveUserIds.push(userId);
    }
  }

  // Set inactive users as away
  for (const userId of inactiveUserIds) {
    await setUserAwayDueToInactivity(userId, socketIO);
  }

  return inactiveUserIds.length;
};

/**
 * Broadcast status change to relevant users
 * @param {Object} user - User object
 * @param {string} newStatus - New status
 * @param {string} previousStatus - Previous status
 * @param {Object} socketIO - Socket.IO instance
 */
const broadcastStatusChange = async (
  user,
  newStatus,
  previousStatus,
  socketIO
) => {
  try {
    const statusUpdate = {
      userId: user._id,
      status: newStatus,
      previousStatus,
      fullName: user.fullName,
      timestamp: new Date(),
    };

    // Broadcast to organization room
    const orgRoom = `org_${user.organization._id}`;
    socketIO.to(orgRoom).emit("userStatusChange", statusUpdate);

    // Broadcast to department room
    const deptRoom = `dept_${user.department._id}`;
    socketIO.to(deptRoom).emit("userStatusChange", statusUpdate);

    // Status change broadcasted successfully
  } catch (error) {
    console.error("Error broadcasting status change:", error);
  }
};

/**
 * Handle user connection (set online)
 * @param {string} userId - User ID
 * @param {Object} socketIO - Socket.IO instance
 * @returns {Promise<Object>} Updated user status
 */
export const handleUserConnect = async (userId, socketIO = null) => {
  return await updateUserStatus(userId, USER_STATUS.ONLINE, socketIO);
};

/**
 * Handle user disconnection (set offline)
 * @param {string} userId - User ID
 * @param {Object} socketIO - Socket.IO instance
 * @returns {Promise<Object>} Updated user status
 */
export const handleUserDisconnect = async (userId, socketIO = null) => {
  return await updateUserStatus(userId, USER_STATUS.OFFLINE, socketIO);
};

/**
 * Initialize status tracking system
 * Sets up periodic checks for inactive users
 * @param {Object} socketIO - Socket.IO instance
 */
export const initializeStatusTracking = (socketIO) => {
  // Check for inactive users every 5 minutes
  setInterval(async () => {
    try {
      const inactiveCount = await checkInactiveUsers(socketIO);
      // Inactive users processed
    } catch (error) {
      console.error("Error in periodic inactive user check:", error);
    }
  }, 5 * 60 * 1000); // 5 minutes

  // User status tracking system initialized
};

/**
 * Cleanup status tracking for user
 * @param {string} userId - User ID
 */
export const cleanupUserStatusTracking = (userId) => {
  userActivityMap.delete(userId);
};

export default {
  USER_STATUS,
  updateUserStatus,
  getUserStatus,
  getMultipleUserStatus,
  getOnlineUsersInOrganization,
  getOnlineUsersInDepartment,
  updateUserActivity,
  setUserAwayDueToInactivity,
  checkInactiveUsers,
  handleUserConnect,
  handleUserDisconnect,
  initializeStatusTracking,
  cleanupUserStatusTracking,
};

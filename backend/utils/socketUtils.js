/**
 * Socket.IO Utility Functions
 * Helper functions for Socket.IO room management and event broadcasting
 */

import { SOCKET_EVENTS } from "../constants/index.js";

/**
 * Get Socket.IO instance from Express app
 * @param {Object} app - Express application instance
 * @returns {Object} Socket.IO server instance
 */
export const getSocketIO = (app) => {
  return app.get("io");
};

/**
 * Generate room names for different scopes
 * @param {string} type - Room type (org, dept, user, task, etc.)
 * @param {string} id - Entity ID
 * @returns {string} Room name
 */
export const generateRoomName = (type, id) => {
  return `${type}_${id}`;
};

/**
 * Broadcast event to organization room
 * @param {Object} io - Socket.IO instance
 * @param {string} organizationId - Organization ID
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
export const broadcastToOrganization = (io, organizationId, event, data) => {
  const roomName = generateRoomName("org", organizationId);
  io.to(roomName).emit(event, data);
};

/**
 * Broadcast event to department room
 * @param {Object} io - Socket.IO instance
 * @param {string} departmentId - Department ID
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
export const broadcastToDepartment = (io, departmentId, event, data) => {
  const roomName = generateRoomName("dept", departmentId);
  io.to(roomName).emit(event, data);
};

/**
 * Send event to specific user
 * @param {Object} io - Socket.IO instance
 * @param {string} userId - User ID
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
export const sendToUser = (io, userId, event, data) => {
  const roomName = generateRoomName("user", userId);
  io.to(roomName).emit(event, data);
};

/**
 * Broadcast event to platform administrators
 * @param {Object} io - Socket.IO instance
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
export const broadcastToPlatform = (io, event, data) => {
  io.to("platform").emit(event, data);
};

/**
 * Broadcast task-related events
 * @param {Object} io - Socket.IO instance
 * @param {Object} task - Task object
 * @param {string} eventType - Event type (created, updated, deleted, etc.)
 * @param {Object} additionalData - Additional event data
 */
export const broadcastTaskEvent = (
  io,
  task,
  eventType,
  additionalData = {}
) => {
  const eventName = `task_${eventType}`;
  const eventData = {
    task: {
      _id: task._id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      taskType: task.taskType,
      organization: task.organization,
      department: task.department,
    },
    ...additionalData,
  };

  // Broadcast to organization
  broadcastToOrganization(
    io,
    task.organization.toString(),
    eventName,
    eventData
  );

  // If task has assignees, send to each assignee
  if (task.assignees && Array.isArray(task.assignees)) {
    task.assignees.forEach((assigneeId) => {
      sendToUser(io, assigneeId.toString(), eventName, eventData);
    });
  }
};

/**
 * Broadcast notification events
 * @param {Object} io - Socket.IO instance
 * @param {Object} notification - Notification object
 */
export const broadcastNotification = (io, notification) => {
  const eventData = {
    _id: notification._id,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    priority: notification.priority,
    createdAt: notification.createdAt,
  };

  // Send to specific recipients
  if (notification.recipients && Array.isArray(notification.recipients)) {
    notification.recipients.forEach((recipientId) => {
      sendToUser(
        io,
        recipientId.toString(),
        SOCKET_EVENTS.NOTIFICATION_CREATED,
        eventData
      );
    });
  }

  // Also broadcast to organization if it's a general notification
  if (notification.organization) {
    broadcastToOrganization(
      io,
      notification.organization.toString(),
      SOCKET_EVENTS.NOTIFICATION_CREATED,
      eventData
    );
  }
};

/**
 * Broadcast comment events
 * @param {Object} io - Socket.IO instance
 * @param {Object} comment - Comment object
 * @param {string} eventType - Event type (added, updated, deleted)
 */
export const broadcastCommentEvent = (io, comment, eventType) => {
  const eventName = `comment_${eventType}`;
  const eventData = {
    comment: {
      _id: comment._id,
      content: comment.content,
      author: comment.author,
      task: comment.task,
      createdAt: comment.createdAt,
    },
  };

  // Broadcast to organization
  if (comment.organization) {
    broadcastToOrganization(
      io,
      comment.organization.toString(),
      eventName,
      eventData
    );
  }

  // Send to task assignees if available
  if (comment.task && comment.task.assignees) {
    comment.task.assignees.forEach((assigneeId) => {
      sendToUser(io, assigneeId.toString(), eventName, eventData);
    });
  }
};

/**
 * Broadcast activity events
 * @param {Object} io - Socket.IO instance
 * @param {Object} activity - Activity object
 * @param {string} eventType - Event type (added, updated)
 */
export const broadcastActivityEvent = (io, activity, eventType) => {
  const eventName = `activity_${eventType}`;
  const eventData = {
    activity: {
      _id: activity._id,
      description: activity.description,
      status: activity.status,
      user: activity.user,
      task: activity.task,
      createdAt: activity.createdAt,
    },
  };

  // Broadcast to organization
  if (activity.organization) {
    broadcastToOrganization(
      io,
      activity.organization.toString(),
      eventName,
      eventData
    );
  }

  // Send to task assignees if available
  if (activity.task && activity.task.assignees) {
    activity.task.assignees.forEach((assigneeId) => {
      sendToUser(io, assigneeId.toString(), eventName, eventData);
    });
  }
};

/**
 * Handle user status updates
 * @param {Object} io - Socket.IO instance
 * @param {string} userId - User ID
 * @param {string} organizationId - Organization ID
 * @param {string} status - User status (online, offline, away)
 * @param {Object} userInfo - Additional user information
 */
export const broadcastUserStatus = (
  io,
  userId,
  organizationId,
  status,
  userInfo = {}
) => {
  const eventData = {
    userId,
    status,
    ...userInfo,
    timestamp: new Date().toISOString(),
  };

  // Broadcast to organization
  broadcastToOrganization(
    io,
    organizationId,
    SOCKET_EVENTS.USER_STATUS_UPDATE,
    eventData
  );
};

/**
 * Create a room for a specific task
 * @param {Object} io - Socket.IO instance
 * @param {string} taskId - Task ID
 * @param {Array} userIds - Array of user IDs to add to the room
 */
export const createTaskRoom = (io, taskId, userIds = []) => {
  const roomName = generateRoomName("task", taskId);

  // Add users to the task room
  userIds.forEach((userId) => {
    const userRoom = generateRoomName("user", userId);
    // Find sockets in user room and add them to task room
    io.in(userRoom).socketsJoin(roomName);
  });

  return roomName;
};

/**
 * Remove users from a task room
 * @param {Object} io - Socket.IO instance
 * @param {string} taskId - Task ID
 * @param {Array} userIds - Array of user IDs to remove from the room
 */
export const removeFromTaskRoom = (io, taskId, userIds = []) => {
  const roomName = generateRoomName("task", taskId);

  // Remove users from the task room
  userIds.forEach((userId) => {
    const userRoom = generateRoomName("user", userId);
    // Find sockets in user room and remove them from task room
    io.in(userRoom).socketsLeave(roomName);
  });
};

/**
 * Get connected users in a room
 * @param {Object} io - Socket.IO instance
 * @param {string} roomName - Room name
 * @returns {Promise<Array>} Array of socket IDs in the room
 */
export const getRoomUsers = async (io, roomName) => {
  try {
    const sockets = await io.in(roomName).fetchSockets();
    return sockets.map((socket) => ({
      socketId: socket.id,
      userId: socket.user?._id,
      email: socket.user?.email,
    }));
  } catch (error) {
    console.error("Error fetching room users:", error);
    return [];
  }
};

/**
 * Broadcast system-wide announcements to all connected users
 * @param {Object} io - Socket.IO instance
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
export const broadcastSystemAnnouncement = (io, event, data) => {
  io.emit(event, {
    ...data,
    type: "system_announcement",
    timestamp: new Date().toISOString(),
  });
};

/**
 * Get organization statistics (connected users, active rooms, etc.)
 * @param {Object} io - Socket.IO instance
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} Organization statistics
 */
export const getOrganizationStats = async (io, organizationId) => {
  try {
    const orgRoom = generateRoomName("org", organizationId);
    const connectedUsers = await getRoomUsers(io, orgRoom);

    return {
      organizationId,
      connectedUsers: connectedUsers.length,
      users: connectedUsers,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error fetching organization stats:", error);
    return {
      organizationId,
      connectedUsers: 0,
      users: [],
      error: error.message,
    };
  }
};

/**
 * Disconnect all users from a specific organization (for maintenance)
 * @param {Object} io - Socket.IO instance
 * @param {string} organizationId - Organization ID
 * @param {string} reason - Disconnection reason
 */
export const disconnectOrganizationUsers = async (
  io,
  organizationId,
  reason = "Maintenance"
) => {
  try {
    const orgRoom = generateRoomName("org", organizationId);
    const sockets = await io.in(orgRoom).fetchSockets();

    // Notify users before disconnecting
    io.to(orgRoom).emit("maintenance_notice", {
      message:
        "System maintenance in progress. You will be disconnected shortly.",
      reason,
      timestamp: new Date().toISOString(),
    });

    // Disconnect after a brief delay
    setTimeout(() => {
      sockets.forEach((socket) => {
        socket.disconnect(true);
      });
    }, 5000); // 5 second delay

    return { disconnected: sockets.length };
  } catch (error) {
    console.error("Error disconnecting organization users:", error);
    return { error: error.message };
  }
};

export default {
  getSocketIO,
  generateRoomName,
  broadcastToOrganization,
  broadcastToDepartment,
  sendToUser,
  broadcastToPlatform,
  broadcastTaskEvent,
  broadcastNotification,
  broadcastCommentEvent,
  broadcastActivityEvent,
  broadcastUserStatus,
  createTaskRoom,
  removeFromTaskRoom,
  getRoomUsers,
  broadcastSystemAnnouncement,
  getOrganizationStats,
  disconnectOrganizationUsers,
};

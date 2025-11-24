/**
 * Socket.IO Event Handlers
 * Comprehensive event handling for real-time communication
 * Implements room management, authentication, and event broadcasting
 */

import { SOCKET_EVENTS, USER_STATUS } from "../constants/index.js";
import {
  broadcastToOrganization,
  broadcastToDepartment,
  sendToUser,
  broadcastToPlatform,
  generateRoomName,
  getRoomUsers,
} from "../utils/socketUtils.js";
import CustomError from "../utils/CustomError.js";

/**
 * Socket.IO Authentication Middleware
 * Validates JWT tokens and attaches user context to socket
 */
export const socketAuthMiddleware = async (socket, next) => {
  try {
    // Extract token from handshake auth or cookies
    const token =
      socket.handshake.auth.token ||
      socket.handshake.headers.cookie?.match(/accessToken=([^;]+)/)?.[1];

    if (!token) {
      throw new Error("Authentication token required");
    }

    // Import here to avoid circular dependencies
    const { verifyAccessToken } = await import("../utils/jwtUtils.js");
    const User = (await import("../models/User.js")).default;

    // Verify JWT token
    const decoded = verifyAccessToken(token);

    // Fetch user with organization and department
    const user = await User.findById(decoded.userId)
      .populate({
        path: "organization",
        select: "name _id isPlatformOrg isDeleted deletedAt deletedBy",
      })
      .populate({
        path: "department",
        select: "name _id isDeleted deletedAt deletedBy",
      })
      .select(
        "-password -refreshToken -refreshTokenExpiry +isDeleted +deletedAt +deletedBy"
      );

    if (
      !user ||
      user.isDeleted ||
      user.organization?.isDeleted ||
      user.department?.isDeleted
    ) {
      throw new Error("User account or organization is deactivated");
    }

    // Verify token data matches user data
    if (
      decoded.email !== user.email ||
      decoded.organizationId !== user.organization._id.toString() ||
      decoded.departmentId !== user.department._id.toString()
    ) {
      throw new Error("Token data mismatch");
    }

    // Attach user data to socket
    socket.user = {
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      organization: {
        _id: user.organization._id,
        name: user.organization.name,
        isPlatformOrg: user.organization.isPlatformOrg || false,
      },
      department: {
        _id: user.department._id,
        name: user.department.name,
      },
      isPlatformUser: user.isPlatformUser || false,
      isHod: user.isHod || false,
    };

    next();
  } catch (error) {
    console.error("Socket authentication error:", error.message);
    next(new Error("Authentication failed"));
  }
};

/**
 * Room Management Functions
 */
export const roomManager = {
  /**
   * Join user to organization and department rooms
   */
  joinUserRooms: (socket) => {
    const orgRoom = generateRoomName("org", socket.user.organization._id);
    const deptRoom = generateRoomName("dept", socket.user.department._id);
    const userRoom = generateRoomName("user", socket.user._id);

    socket.join(orgRoom);
    socket.join(deptRoom);
    socket.join(userRoom);

    // Platform admins can join platform room
    if (socket.user.isPlatformUser || socket.user.organization.isPlatformOrg) {
      socket.join("platform");
    }

    return { orgRoom, deptRoom, userRoom };
  },

  /**
   * Validate room access based on user permissions
   */
  validateRoomAccess: (socket, roomId) => {
    const user = socket.user;

    // Parse room type and ID
    const [roomType, entityId] = roomId.split("_");

    switch (roomType) {
      case "org":
        // User can only access their own organization room
        // Platform users can access any organization room
        return (
          user.isPlatformUser ||
          user.organization.isPlatformOrg ||
          entityId === user.organization._id.toString()
        );

      case "dept":
        // User can only access their own department room
        // Platform users and HODs can access any department in their org
        if (user.isPlatformUser || user.organization.isPlatformOrg) {
          return true;
        }
        return entityId === user.department._id.toString();

      case "user":
        // Users can access their own room
        // Platform users can access any user room
        return (
          user.isPlatformUser ||
          user.organization.isPlatformOrg ||
          entityId === user._id.toString()
        );

      case "task":
        // Task room access will be validated against task assignees
        // For now, allow access within organization boundaries
        return true; // Will be enhanced when task controllers are implemented

      case "platform":
        // Only platform users can access platform room
        return user.isPlatformUser || user.organization.isPlatformOrg;

      default:
        return false;
    }
  },

  /**
   * Join a specific room with validation
   */
  joinRoom: (socket, roomId) => {
    if (!roomId || typeof roomId !== "string") {
      socket.emit("error", { message: "Invalid room ID" });
      return false;
    }

    if (!roomManager.validateRoomAccess(socket, roomId)) {
      socket.emit("error", { message: "Access denied to room" });
      return false;
    }

    socket.join(roomId);
    socket.emit("room_joined", { roomId });
    return true;
  },

  /**
   * Leave a specific room
   */
  leaveRoom: (socket, roomId) => {
    if (!roomId || typeof roomId !== "string") {
      socket.emit("error", { message: "Invalid room ID" });
      return false;
    }

    socket.leave(roomId);
    socket.emit("room_left", { roomId });
    return true;
  },
};

/**
 * User Status Event Handlers
 */
export const userStatusHandlers = {
  /**
   * Handle user status updates
   */
  handleStatusUpdate: (socket, status) => {
    const validStatuses = Object.values(USER_STATUS);

    if (!validStatuses.includes(status)) {
      socket.emit("error", { message: "Invalid status value" });
      return;
    }

    const orgRoom = generateRoomName("org", socket.user.organization._id);

    // Broadcast status update to organization
    socket.to(orgRoom).emit(SOCKET_EVENTS.USER_STATUS_UPDATE, {
      userId: socket.user._id,
      email: socket.user.email,
      firstName: socket.user.firstName,
      lastName: socket.user.lastName,
      status,
      timestamp: new Date().toISOString(),
    });

    // Acknowledge status update
    socket.emit("status_updated", { status });
  },

  /**
   * Broadcast user online status
   */
  broadcastUserOnline: (socket) => {
    const orgRoom = generateRoomName("org", socket.user.organization._id);

    socket.to(orgRoom).emit(SOCKET_EVENTS.USER_ONLINE, {
      userId: socket.user._id,
      email: socket.user.email,
      firstName: socket.user.firstName,
      lastName: socket.user.lastName,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Broadcast user offline status
   */
  broadcastUserOffline: (socket) => {
    const orgRoom = generateRoomName("org", socket.user.organization._id);

    socket.to(orgRoom).emit(SOCKET_EVENTS.USER_OFFLINE, {
      userId: socket.user._id,
      email: socket.user.email,
      firstName: socket.user.firstName,
      lastName: socket.user.lastName,
      timestamp: new Date().toISOString(),
    });
  },
};

/**
 * Task Event Handlers
 */
export const taskEventHandlers = {
  /**
   * Handle task creation events
   */
  handleTaskCreated: (io, taskData) => {
    const eventData = {
      task: {
        _id: taskData._id,
        title: taskData.title,
        status: taskData.status,
        priority: taskData.priority,
        taskType: taskData.taskType,
        createdBy: taskData.createdBy,
        organization: taskData.organization,
        department: taskData.department,
      },
      timestamp: new Date().toISOString(),
    };

    // Broadcast to organization
    broadcastToOrganization(
      io,
      taskData.organization.toString(),
      SOCKET_EVENTS.TASK_CREATED,
      eventData
    );

    // Send to assignees if available
    if (taskData.assignees && Array.isArray(taskData.assignees)) {
      taskData.assignees.forEach((assigneeId) => {
        sendToUser(io, assigneeId.toString(), SOCKET_EVENTS.TASK_ASSIGNED, {
          ...eventData,
          assignedTo: assigneeId,
        });
      });
    }
  },

  /**
   * Handle task update events
   */
  handleTaskUpdated: (io, taskData, changes = {}) => {
    const eventData = {
      task: {
        _id: taskData._id,
        title: taskData.title,
        status: taskData.status,
        priority: taskData.priority,
        taskType: taskData.taskType,
        organization: taskData.organization,
        department: taskData.department,
      },
      changes,
      timestamp: new Date().toISOString(),
    };

    // Broadcast to organization
    broadcastToOrganization(
      io,
      taskData.organization.toString(),
      SOCKET_EVENTS.TASK_UPDATED,
      eventData
    );

    // Send to assignees if available
    if (taskData.assignees && Array.isArray(taskData.assignees)) {
      taskData.assignees.forEach((assigneeId) => {
        sendToUser(
          io,
          assigneeId.toString(),
          SOCKET_EVENTS.TASK_UPDATED,
          eventData
        );
      });
    }
  },

  /**
   * Handle task completion events
   */
  handleTaskCompleted: (io, taskData) => {
    const eventData = {
      task: {
        _id: taskData._id,
        title: taskData.title,
        status: taskData.status,
        completedAt: taskData.completedAt,
        completedBy: taskData.completedBy,
        organization: taskData.organization,
        department: taskData.department,
      },
      timestamp: new Date().toISOString(),
    };

    // Broadcast to organization
    broadcastToOrganization(
      io,
      taskData.organization.toString(),
      SOCKET_EVENTS.TASK_COMPLETED,
      eventData
    );

    // Send to assignees if available
    if (taskData.assignees && Array.isArray(taskData.assignees)) {
      taskData.assignees.forEach((assigneeId) => {
        sendToUser(
          io,
          assigneeId.toString(),
          SOCKET_EVENTS.TASK_COMPLETED,
          eventData
        );
      });
    }
  },

  /**
   * Handle task deletion events
   */
  handleTaskDeleted: (io, taskData) => {
    const eventData = {
      taskId: taskData._id,
      title: taskData.title,
      organization: taskData.organization,
      department: taskData.department,
      deletedBy: taskData.deletedBy,
      timestamp: new Date().toISOString(),
    };

    // Broadcast to organization
    broadcastToOrganization(
      io,
      taskData.organization.toString(),
      SOCKET_EVENTS.TASK_DELETED,
      eventData
    );
  },
};

/**
 * Notification Event Handlers
 */
export const notificationHandlers = {
  /**
   * Handle notification creation
   */
  handleNotificationCreated: (io, notificationData) => {
    const eventData = {
      notification: {
        _id: notificationData._id,
        title: notificationData.title,
        message: notificationData.message,
        type: notificationData.type,
        priority: notificationData.priority,
        createdAt: notificationData.createdAt,
      },
      timestamp: new Date().toISOString(),
    };

    // Send to specific recipients
    if (
      notificationData.recipients &&
      Array.isArray(notificationData.recipients)
    ) {
      notificationData.recipients.forEach((recipientId) => {
        sendToUser(
          io,
          recipientId.toString(),
          SOCKET_EVENTS.NOTIFICATION_CREATED,
          eventData
        );
      });
    }

    // Also broadcast to organization if it's a general notification
    if (notificationData.organization && !notificationData.recipients) {
      broadcastToOrganization(
        io,
        notificationData.organization.toString(),
        SOCKET_EVENTS.NOTIFICATION_CREATED,
        eventData
      );
    }
  },

  /**
   * Handle notification read status
   */
  handleNotificationRead: (io, notificationId, userId) => {
    const eventData = {
      notificationId,
      userId,
      readAt: new Date().toISOString(),
    };

    // Send acknowledgment to user
    sendToUser(
      io,
      userId.toString(),
      SOCKET_EVENTS.NOTIFICATION_READ,
      eventData
    );
  },
};

/**
 * Comment Event Handlers
 */
export const commentHandlers = {
  /**
   * Handle comment creation
   */
  handleCommentAdded: (io, commentData) => {
    const eventData = {
      comment: {
        _id: commentData._id,
        content: commentData.content,
        author: commentData.author,
        task: commentData.task,
        parentComment: commentData.parentComment,
        mentions: commentData.mentions,
        createdAt: commentData.createdAt,
      },
      timestamp: new Date().toISOString(),
    };

    // Broadcast to organization
    if (commentData.organization) {
      broadcastToOrganization(
        io,
        commentData.organization.toString(),
        SOCKET_EVENTS.COMMENT_ADDED,
        eventData
      );
    }

    // Send to mentioned users
    if (commentData.mentions && Array.isArray(commentData.mentions)) {
      commentData.mentions.forEach((mentionedUserId) => {
        sendToUser(
          io,
          mentionedUserId.toString(),
          SOCKET_EVENTS.COMMENT_ADDED,
          {
            ...eventData,
            mentioned: true,
          }
        );
      });
    }

    // Send to task assignees if available
    if (commentData.task && commentData.task.assignees) {
      commentData.task.assignees.forEach((assigneeId) => {
        sendToUser(
          io,
          assigneeId.toString(),
          SOCKET_EVENTS.COMMENT_ADDED,
          eventData
        );
      });
    }
  },

  /**
   * Handle comment updates
   */
  handleCommentUpdated: (io, commentData) => {
    const eventData = {
      comment: {
        _id: commentData._id,
        content: commentData.content,
        author: commentData.author,
        task: commentData.task,
        updatedAt: commentData.updatedAt,
      },
      timestamp: new Date().toISOString(),
    };

    // Broadcast to organization
    if (commentData.organization) {
      broadcastToOrganization(
        io,
        commentData.organization.toString(),
        SOCKET_EVENTS.COMMENT_UPDATED,
        eventData
      );
    }
  },

  /**
   * Handle comment deletion
   */
  handleCommentDeleted: (io, commentData) => {
    const eventData = {
      commentId: commentData._id,
      task: commentData.task,
      deletedBy: commentData.deletedBy,
      timestamp: new Date().toISOString(),
    };

    // Broadcast to organization
    if (commentData.organization) {
      broadcastToOrganization(
        io,
        commentData.organization.toString(),
        SOCKET_EVENTS.COMMENT_DELETED,
        eventData
      );
    }
  },
};

/**
 * Activity Event Handlers
 */
export const activityHandlers = {
  /**
   * Handle activity creation
   */
  handleActivityAdded: (io, activityData) => {
    const eventData = {
      activity: {
        _id: activityData._id,
        description: activityData.description,
        status: activityData.status,
        user: activityData.user,
        task: activityData.task,
        createdAt: activityData.createdAt,
      },
      timestamp: new Date().toISOString(),
    };

    // Broadcast to organization
    if (activityData.organization) {
      broadcastToOrganization(
        io,
        activityData.organization.toString(),
        SOCKET_EVENTS.ACTIVITY_ADDED,
        eventData
      );
    }

    // Send to task assignees if available
    if (activityData.task && activityData.task.assignees) {
      activityData.task.assignees.forEach((assigneeId) => {
        sendToUser(
          io,
          assigneeId.toString(),
          SOCKET_EVENTS.ACTIVITY_ADDED,
          eventData
        );
      });
    }
  },

  /**
   * Handle activity updates
   */
  handleActivityUpdated: (io, activityData) => {
    const eventData = {
      activity: {
        _id: activityData._id,
        description: activityData.description,
        status: activityData.status,
        user: activityData.user,
        task: activityData.task,
        updatedAt: activityData.updatedAt,
      },
      timestamp: new Date().toISOString(),
    };

    // Broadcast to organization
    if (activityData.organization) {
      broadcastToOrganization(
        io,
        activityData.organization.toString(),
        SOCKET_EVENTS.ACTIVITY_UPDATED,
        eventData
      );
    }
  },
};

/**
 * Connection Event Handlers
 */
export const connectionHandlers = {
  /**
   * Handle new socket connection
   */
  handleConnection: (socket, io) => {
    console.log(`User connected: ${socket.user.email} (${socket.id})`);

    // Join user to appropriate rooms
    const rooms = roomManager.joinUserRooms(socket);

    // Emit authentication success
    socket.emit(SOCKET_EVENTS.AUTHENTICATION_SUCCESS, {
      user: socket.user,
      rooms: Object.values(rooms),
      timestamp: new Date().toISOString(),
    });

    // Broadcast user online status
    userStatusHandlers.broadcastUserOnline(socket);

    // Set up event listeners
    connectionHandlers.setupEventListeners(socket, io);
  },

  /**
   * Handle socket disconnection
   */
  handleDisconnection: (socket, reason) => {
    console.log(
      `User disconnected: ${socket.user.email} (${socket.id}) - Reason: ${reason}`
    );

    // Broadcast user offline status
    userStatusHandlers.broadcastUserOffline(socket);
  },

  /**
   * Set up event listeners for socket
   */
  setupEventListeners: (socket, io) => {
    // User status events
    socket.on(SOCKET_EVENTS.USER_STATUS_UPDATE, (status) => {
      userStatusHandlers.handleStatusUpdate(socket, status);
    });

    // Room management events
    socket.on(SOCKET_EVENTS.JOIN_ROOM, (roomId) => {
      roomManager.joinRoom(socket, roomId);
    });

    socket.on(SOCKET_EVENTS.LEAVE_ROOM, (roomId) => {
      roomManager.leaveRoom(socket, roomId);
    });

    // Disconnection event
    socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
      connectionHandlers.handleDisconnection(socket, reason);
    });

    // Error handling
    socket.on("error", (error) => {
      console.error(`Socket error for user ${socket.user.email}:`, error);
      socket.emit("error", { message: "An error occurred" });
    });

    // Ping/Pong for connection health
    socket.on("ping", () => {
      socket.emit("pong", { timestamp: new Date().toISOString() });
    });
  },
};

/**
 * Initialize Socket.IO with comprehensive event handling
 */
export const initializeSocketHandlers = (io) => {
  // Set up authentication middleware
  io.use(socketAuthMiddleware);

  // Handle connections
  io.on(SOCKET_EVENTS.CONNECTION, (socket) => {
    connectionHandlers.handleConnection(socket, io);
  });

  // Make event handlers available for controllers
  io.taskEvents = taskEventHandlers;
  io.notificationEvents = notificationHandlers;
  io.commentEvents = commentHandlers;
  io.activityEvents = activityHandlers;

  console.log("Socket.IO handlers initialized successfully");
};

export default {
  socketAuthMiddleware,
  roomManager,
  userStatusHandlers,
  taskEventHandlers,
  notificationHandlers,
  commentHandlers,
  activityHandlers,
  connectionHandlers,
  initializeSocketHandlers,
};

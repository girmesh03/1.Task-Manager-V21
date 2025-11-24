/**
 * Socket.IO Handlers Test Suite
 * Tests for comprehensive Socket.IO event handling system
 */

import { jest } from "@jest/globals";
import {
  socketAuthMiddleware,
  roomManager,
  userStatusHandlers,
  taskEventHandlers,
  notificationHandlers,
  commentHandlers,
  activityHandlers,
  connectionHandlers,
  initializeSocketHandlers,
} from "../socket/socketHandlers.js";
import { SOCKET_EVENTS, USER_STATUS } from "../constants/index.js";

// Mock dependencies
const mockUser = {
  _id: "user123",
  email: "test@example.com",
  firstName: "Test",
  lastName: "User",
  role: "User",
  organization: {
    _id: "org123",
    name: "Test Org",
    isPlatformOrg: false,
  },
  department: {
    _id: "dept123",
    name: "Test Dept",
  },
  isPlatformUser: false,
  isHod: false,
  isDeleted: false,
};

const mockSocket = {
  id: "socket123",
  user: mockUser,
  join: jest.fn(),
  leave: jest.fn(),
  emit: jest.fn(),
  to: jest.fn(() => ({ emit: jest.fn() })),
  on: jest.fn(),
  handshake: {
    auth: { token: "valid-token" },
    headers: {},
  },
};

const mockIO = {
  use: jest.fn(),
  on: jest.fn(),
  to: jest.fn(() => ({ emit: jest.fn() })),
  emit: jest.fn(),
  in: jest.fn(() => ({
    fetchSockets: jest.fn(() => Promise.resolve([])),
    socketsJoin: jest.fn(),
    socketsLeave: jest.fn(),
  })),
};

describe("Socket.IO Handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Room Manager", () => {
    test("should join user to appropriate rooms", () => {
      const rooms = roomManager.joinUserRooms(mockSocket);

      expect(mockSocket.join).toHaveBeenCalledWith("org_org123");
      expect(mockSocket.join).toHaveBeenCalledWith("dept_dept123");
      expect(mockSocket.join).toHaveBeenCalledWith("user_user123");
      expect(rooms).toEqual({
        orgRoom: "org_org123",
        deptRoom: "dept_dept123",
        userRoom: "user_user123",
      });
    });

    test("should validate room access correctly", () => {
      // User can access their own organization room
      expect(roomManager.validateRoomAccess(mockSocket, "org_org123")).toBe(
        true
      );

      // User cannot access other organization room
      expect(roomManager.validateRoomAccess(mockSocket, "org_other123")).toBe(
        false
      );

      // User can access their own department room
      expect(roomManager.validateRoomAccess(mockSocket, "dept_dept123")).toBe(
        true
      );

      // User cannot access other department room
      expect(roomManager.validateRoomAccess(mockSocket, "dept_other123")).toBe(
        false
      );

      // User can access their own user room
      expect(roomManager.validateRoomAccess(mockSocket, "user_user123")).toBe(
        true
      );

      // User cannot access other user room
      expect(roomManager.validateRoomAccess(mockSocket, "user_other123")).toBe(
        false
      );
    });

    test("should validate platform user access", () => {
      const platformSocket = {
        ...mockSocket,
        user: {
          ...mockUser,
          isPlatformUser: true,
        },
      };

      // Platform user can access any organization room
      expect(
        roomManager.validateRoomAccess(platformSocket, "org_other123")
      ).toBe(true);

      // Platform user can access any department room
      expect(
        roomManager.validateRoomAccess(platformSocket, "dept_other123")
      ).toBe(true);

      // Platform user can access platform room
      expect(roomManager.validateRoomAccess(platformSocket, "platform")).toBe(
        true
      );
    });

    test("should join room with validation", () => {
      const result = roomManager.joinRoom(mockSocket, "org_org123");

      expect(result).toBe(true);
      expect(mockSocket.join).toHaveBeenCalledWith("org_org123");
      expect(mockSocket.emit).toHaveBeenCalledWith("room_joined", {
        roomId: "org_org123",
      });
    });

    test("should reject invalid room access", () => {
      const result = roomManager.joinRoom(mockSocket, "org_other123");

      expect(result).toBe(false);
      expect(mockSocket.emit).toHaveBeenCalledWith("error", {
        message: "Access denied to room",
      });
    });

    test("should leave room successfully", () => {
      const result = roomManager.leaveRoom(mockSocket, "org_org123");

      expect(result).toBe(true);
      expect(mockSocket.leave).toHaveBeenCalledWith("org_org123");
      expect(mockSocket.emit).toHaveBeenCalledWith("room_left", {
        roomId: "org_org123",
      });
    });
  });

  describe("User Status Handlers", () => {
    test("should handle valid status update", () => {
      userStatusHandlers.handleStatusUpdate(mockSocket, USER_STATUS.AWAY);

      expect(mockSocket.to).toHaveBeenCalledWith("org_org123");
      expect(mockSocket.emit).toHaveBeenCalledWith("status_updated", {
        status: USER_STATUS.AWAY,
      });
    });

    test("should reject invalid status", () => {
      userStatusHandlers.handleStatusUpdate(mockSocket, "invalid_status");

      expect(mockSocket.emit).toHaveBeenCalledWith("error", {
        message: "Invalid status value",
      });
    });

    test("should broadcast user online status", () => {
      userStatusHandlers.broadcastUserOnline(mockSocket);

      expect(mockSocket.to).toHaveBeenCalledWith("org_org123");
    });

    test("should broadcast user offline status", () => {
      userStatusHandlers.broadcastUserOffline(mockSocket);

      expect(mockSocket.to).toHaveBeenCalledWith("org_org123");
    });
  });

  describe("Task Event Handlers", () => {
    const mockTaskData = {
      _id: "task123",
      title: "Test Task",
      status: "To Do",
      priority: "Medium",
      taskType: "AssignedTask",
      organization: "org123",
      department: "dept123",
      assignees: ["user123", "user456"],
    };

    test("should handle task creation", () => {
      taskEventHandlers.handleTaskCreated(mockIO, mockTaskData);

      expect(mockIO.to).toHaveBeenCalledWith("org_org123");
    });

    test("should handle task updates", () => {
      const changes = { status: "In Progress" };
      taskEventHandlers.handleTaskUpdated(mockIO, mockTaskData, changes);

      expect(mockIO.to).toHaveBeenCalledWith("org_org123");
    });

    test("should handle task completion", () => {
      const completedTask = {
        ...mockTaskData,
        status: "Completed",
        completedAt: new Date(),
        completedBy: "user123",
      };

      taskEventHandlers.handleTaskCompleted(mockIO, completedTask);

      expect(mockIO.to).toHaveBeenCalledWith("org_org123");
    });

    test("should handle task deletion", () => {
      const deletedTask = {
        ...mockTaskData,
        deletedBy: "user123",
      };

      taskEventHandlers.handleTaskDeleted(mockIO, deletedTask);

      expect(mockIO.to).toHaveBeenCalledWith("org_org123");
    });
  });

  describe("Notification Handlers", () => {
    const mockNotificationData = {
      _id: "notification123",
      title: "Test Notification",
      message: "This is a test notification",
      type: "task_assigned",
      priority: "medium",
      recipients: ["user123", "user456"],
      organization: "org123",
      createdAt: new Date(),
    };

    test("should handle notification creation with recipients", () => {
      notificationHandlers.handleNotificationCreated(
        mockIO,
        mockNotificationData
      );

      expect(mockIO.to).toHaveBeenCalledWith("user_user123");
      expect(mockIO.to).toHaveBeenCalledWith("user_user456");
    });

    test("should handle notification creation for organization", () => {
      const orgNotification = {
        ...mockNotificationData,
        recipients: null,
      };

      notificationHandlers.handleNotificationCreated(mockIO, orgNotification);

      expect(mockIO.to).toHaveBeenCalledWith("org_org123");
    });

    test("should handle notification read status", () => {
      notificationHandlers.handleNotificationRead(
        mockIO,
        "notification123",
        "user123"
      );

      expect(mockIO.to).toHaveBeenCalledWith("user_user123");
    });
  });

  describe("Comment Handlers", () => {
    const mockCommentData = {
      _id: "comment123",
      content: "This is a test comment",
      author: "user123",
      task: {
        _id: "task123",
        assignees: ["user123", "user456"],
      },
      mentions: ["user789"],
      organization: "org123",
      createdAt: new Date(),
    };

    test("should handle comment creation", () => {
      commentHandlers.handleCommentAdded(mockIO, mockCommentData);

      expect(mockIO.to).toHaveBeenCalledWith("org_org123");
      expect(mockIO.to).toHaveBeenCalledWith("user_user789"); // mentioned user
    });

    test("should handle comment updates", () => {
      const updatedComment = {
        ...mockCommentData,
        updatedAt: new Date(),
      };

      commentHandlers.handleCommentUpdated(mockIO, updatedComment);

      expect(mockIO.to).toHaveBeenCalledWith("org_org123");
    });

    test("should handle comment deletion", () => {
      const deletedComment = {
        ...mockCommentData,
        deletedBy: "user123",
      };

      commentHandlers.handleCommentDeleted(mockIO, deletedComment);

      expect(mockIO.to).toHaveBeenCalledWith("org_org123");
    });
  });

  describe("Activity Handlers", () => {
    const mockActivityData = {
      _id: "activity123",
      description: "Task status updated",
      status: "In Progress",
      user: "user123",
      task: {
        _id: "task123",
        assignees: ["user123", "user456"],
      },
      organization: "org123",
      createdAt: new Date(),
    };

    test("should handle activity creation", () => {
      activityHandlers.handleActivityAdded(mockIO, mockActivityData);

      expect(mockIO.to).toHaveBeenCalledWith("org_org123");
    });

    test("should handle activity updates", () => {
      const updatedActivity = {
        ...mockActivityData,
        updatedAt: new Date(),
      };

      activityHandlers.handleActivityUpdated(mockIO, updatedActivity);

      expect(mockIO.to).toHaveBeenCalledWith("org_org123");
    });
  });

  describe("Connection Handlers", () => {
    test("should handle connection setup", () => {
      connectionHandlers.handleConnection(mockSocket, mockIO);

      expect(mockSocket.join).toHaveBeenCalledWith("org_org123");
      expect(mockSocket.join).toHaveBeenCalledWith("dept_dept123");
      expect(mockSocket.join).toHaveBeenCalledWith("user_user123");
      expect(mockSocket.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.AUTHENTICATION_SUCCESS,
        expect.objectContaining({
          user: mockUser,
          rooms: expect.any(Array),
        })
      );
    });

    test("should set up event listeners", () => {
      connectionHandlers.setupEventListeners(mockSocket, mockIO);

      expect(mockSocket.on).toHaveBeenCalledWith(
        SOCKET_EVENTS.USER_STATUS_UPDATE,
        expect.any(Function)
      );
      expect(mockSocket.on).toHaveBeenCalledWith(
        SOCKET_EVENTS.JOIN_ROOM,
        expect.any(Function)
      );
      expect(mockSocket.on).toHaveBeenCalledWith(
        SOCKET_EVENTS.LEAVE_ROOM,
        expect.any(Function)
      );
      expect(mockSocket.on).toHaveBeenCalledWith(
        SOCKET_EVENTS.DISCONNECT,
        expect.any(Function)
      );
      expect(mockSocket.on).toHaveBeenCalledWith("error", expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith("ping", expect.any(Function));
    });

    test("should handle disconnection", () => {
      connectionHandlers.handleDisconnection(mockSocket, "client disconnect");

      expect(mockSocket.to).toHaveBeenCalledWith("org_org123");
    });
  });

  describe("Socket.IO Initialization", () => {
    test("should initialize handlers correctly", () => {
      initializeSocketHandlers(mockIO);

      expect(mockIO.use).toHaveBeenCalledWith(socketAuthMiddleware);
      expect(mockIO.on).toHaveBeenCalledWith(
        SOCKET_EVENTS.CONNECTION,
        expect.any(Function)
      );
      expect(mockIO.taskEvents).toBeDefined();
      expect(mockIO.notificationEvents).toBeDefined();
      expect(mockIO.commentEvents).toBeDefined();
      expect(mockIO.activityEvents).toBeDefined();
    });
  });
});

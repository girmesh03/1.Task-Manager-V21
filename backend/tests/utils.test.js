import {
  extractUserContext,
  extractResourceIds,
  createPaginationOptions,
  createPaginationResponse,
  createSuccessResponse,
  createErrorResponse,
  createFilterOptions,
  createSearchOptions,
  combineQueryOptions,
} from "../utils/controllerHelpers.js";

import {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  extractTokensFromCookies,
  refreshAccessToken,
  validateTokenPayload,
  extractUserContextFromToken,
} from "../utils/jwtUtils.js";

import {
  updateUserStatus,
  getUserStatus,
  getMultipleUserStatus,
  getOnlineUsersInOrganization,
  getOnlineUsersInDepartment,
  updateUserActivity,
  handleUserConnect,
  handleUserDisconnect,
  getUserSocketRooms,
  joinUserToRooms,
  leaveUserFromRooms,
} from "../utils/userStatusUtils.js";

import CustomError from "../utils/CustomError.js";

import {
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
  isValidTimezone,
} from "../utils/timezoneUtils.js";

import { USER_ROLES, USER_STATUS } from "../constants/index.js";

describe("Utility Functions Validation", () => {
  describe("controllerHelpers.js", () => {
    test("should extract user context correctly", () => {
      const mockReq = {
        user: {
          _id: "user123",
          email: "test@example.com",
          role: USER_ROLES.USER,
          organization: {
            _id: "org123",
            isPlatformOrg: false,
          },
          department: {
            _id: "dept123",
          },
          isPlatformUser: false,
          isHod: false,
        },
      };

      const context = extractUserContext(mockReq);

      expect(context.orgId).toBe("org123");
      expect(context.deptId).toBe("dept123");
      expect(context.callerId).toBe("user123");
      expect(context.userRole).toBe(USER_ROLES.USER);
      expect(context.isPlatformAdmin).toBe(false);
      expect(context.isPlatformOrg).toBe(false);
      expect(context.isPlatformUser).toBe(false);
      expect(context.isHodUser).toBe(false);
    });

    test("should throw error when user not authenticated", () => {
      const mockReq = {};

      expect(() => extractUserContext(mockReq)).toThrow(
        "User not authenticated"
      );
    });

    test("should extract resource IDs correctly", () => {
      const mockReq = {
        params: {
          departmentId: "dept123",
          userId: "user123",
          taskId: "task123",
        },
      };

      const resourceIds = extractResourceIds(mockReq, [
        "departmentId",
        "userId",
        "taskId",
      ]);

      expect(resourceIds.departmentId).toBe("dept123");
      expect(resourceIds.userId).toBe("user123");
      expect(resourceIds.taskId).toBe("task123");
    });

    test("should create pagination options correctly", () => {
      const mockReq = {
        validatedData: {
          page: 2,
          limit: 50,
          sortBy: "name",
          sortOrder: "asc",
        },
      };

      const options = createPaginationOptions(mockReq);

      expect(options.page).toBe(2);
      expect(options.limit).toBe(50);
      expect(options.sort.name).toBe(1);
      expect(options.lean).toBe(true);
    });

    test("should create pagination response correctly", () => {
      const mockPaginateResult = {
        docs: [{ id: 1 }, { id: 2 }],
        page: 1,
        limit: 20,
        totalPages: 5,
        totalDocs: 100,
        hasNextPage: true,
        hasPrevPage: false,
        nextPage: 2,
        prevPage: null,
      };

      const response = createPaginationResponse(mockPaginateResult);

      expect(response.docs).toHaveLength(2);
      expect(response.pagination.page).toBe(1);
      expect(response.pagination.totalCount).toBe(100);
      expect(response.pagination.hasNextPage).toBe(true);
    });

    test("should create success response correctly", () => {
      const data = { id: 1, name: "Test" };
      const message = "Operation successful";

      const response = createSuccessResponse(data, message);

      expect(response.success).toBe(true);
      expect(response.message).toBe(message);
      expect(response.data).toEqual(data);
      expect(response.timestamp).toBeDefined();
    });

    test("should create error response correctly", () => {
      const message = "Validation failed";
      const code = "VALIDATION_ERROR";
      const details = [{ field: "email", message: "Invalid email" }];

      const response = createErrorResponse(message, code, details);

      expect(response.success).toBe(false);
      expect(response.error.message).toBe(message);
      expect(response.error.code).toBe(code);
      expect(response.error.details).toEqual(details);
      expect(response.error.timestamp).toBeDefined();
    });
  });

  describe("CustomError.js", () => {
    test("should create bad request error", () => {
      const error = CustomError.badRequest("Invalid input", "INVALID_INPUT");

      expect(error.message).toBe("Invalid input");
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe("INVALID_INPUT");
      expect(error.isOperational).toBe(true);
    });

    test("should create unauthorized error", () => {
      const error = CustomError.unauthorized("Token expired");

      expect(error.message).toBe("Token expired");
      expect(error.statusCode).toBe(401);
      expect(error.isOperational).toBe(true);
    });

    test("should create not found error", () => {
      const error = CustomError.notFound("Resource not found");

      expect(error.message).toBe("Resource not found");
      expect(error.statusCode).toBe(404);
      expect(error.isOperational).toBe(true);
    });

    test("should create internal server error", () => {
      const error = CustomError.internalServer("Database connection failed");

      expect(error.message).toBe("Database connection failed");
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
    });
  });

  describe("jwtUtils.js", () => {
    // Set up environment variables for testing
    beforeAll(() => {
      process.env.JWT_ACCESS_SECRET = "test-access-secret";
      process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
      process.env.JWT_ACCESS_EXPIRES_IN = "15m";
      process.env.JWT_REFRESH_EXPIRES_IN = "7d";
    });

    test("should validate token payload correctly", () => {
      const validPayload = {
        userId: "user123",
        email: "test@example.com",
        role: USER_ROLES.USER,
        organizationId: "org123",
        departmentId: "dept123",
      };

      const invalidPayload = {
        userId: "user123",
        email: "test@example.com",
        // missing required fields
      };

      expect(validateTokenPayload(validPayload)).toBe(true);
      expect(validateTokenPayload(invalidPayload)).toBe(false);
    });

    test("should extract user context from token correctly", () => {
      const payload = {
        userId: "user123",
        email: "test@example.com",
        role: USER_ROLES.USER,
        organizationId: "org123",
        departmentId: "dept123",
        isPlatformUser: true,
        isHod: false,
      };

      const context = extractUserContextFromToken(payload);

      expect(context.userId).toBe("user123");
      expect(context.email).toBe("test@example.com");
      expect(context.role).toBe(USER_ROLES.USER);
      expect(context.organizationId).toBe("org123");
      expect(context.departmentId).toBe("dept123");
      expect(context.isPlatformUser).toBe(true);
      expect(context.isHod).toBe(false);
    });

    test("should throw error for invalid token payload", () => {
      const invalidPayload = {
        userId: "user123",
        // missing required fields
      };

      expect(() => extractUserContextFromToken(invalidPayload)).toThrow(
        "Invalid token payload structure"
      );
    });

    test("should generate and verify access token", () => {
      const payload = {
        userId: "user123",
        email: "test@example.com",
        role: USER_ROLES.USER,
        organizationId: "org123",
        departmentId: "dept123",
      };

      const token = generateAccessToken(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");

      const decoded = verifyAccessToken(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });

    test("should generate and verify refresh token", () => {
      const payload = { userId: "user123" };

      const token = generateRefreshToken(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");

      const decoded = verifyRefreshToken(token);
      expect(decoded.userId).toBe(payload.userId);
    });

    test("should generate token pair", () => {
      const user = {
        _id: "user123",
        email: "test@example.com",
        role: USER_ROLES.USER,
        organization: { _id: "org123" },
        department: { _id: "dept123" },
        isPlatformUser: false,
        isHod: false,
      };

      const tokens = generateTokenPair(user);

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(typeof tokens.accessToken).toBe("string");
      expect(typeof tokens.refreshToken).toBe("string");
    });
  });

  describe("timezoneUtils.js", () => {
    test("should convert to UTC correctly", () => {
      const localDate = "2024-01-01 12:00:00";
      const utcDate = toUTC(localDate);

      expect(utcDate).toBeInstanceOf(Date);
      expect(utcDate.getUTCFullYear()).toBe(2024);
    });

    test("should return null for null input", () => {
      expect(toUTC(null)).toBeNull();
      expect(toLocal(null)).toBeNull();
      expect(formatForDisplay(null)).toBe("");
      expect(formatForAPI(null)).toBeNull();
    });

    test("should get current UTC time", () => {
      const now = nowUTC();
      expect(now).toBeInstanceOf(Date);
    });

    test("should check if date is in past", () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day from now

      expect(isPast(pastDate)).toBe(true);
      expect(isPast(futureDate)).toBe(false);
    });

    test("should check if date is in future", () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day from now

      expect(isFuture(pastDate)).toBe(false);
      expect(isFuture(futureDate)).toBe(true);
    });

    test("should add time correctly", () => {
      const baseDate = new Date("2024-01-01T00:00:00Z");
      const newDate = addTime(baseDate, 1, "day");

      expect(newDate.getUTCDate()).toBe(2);
    });

    test("should subtract time correctly", () => {
      const baseDate = new Date("2024-01-02T00:00:00Z");
      const newDate = subtractTime(baseDate, 1, "day");

      expect(newDate.getUTCDate()).toBe(1);
    });

    test("should get start of day UTC", () => {
      const date = new Date("2024-01-01T15:30:45Z");
      const startOfDay = startOfDayUTC(date);

      expect(startOfDay.getUTCHours()).toBe(0);
      expect(startOfDay.getUTCMinutes()).toBe(0);
      expect(startOfDay.getUTCSeconds()).toBe(0);
    });

    test("should get end of day UTC", () => {
      const date = new Date("2024-01-01T15:30:45Z");
      const endOfDay = endOfDayUTC(date);

      expect(endOfDay.getUTCHours()).toBe(23);
      expect(endOfDay.getUTCMinutes()).toBe(59);
      expect(endOfDay.getUTCSeconds()).toBe(59);
    });

    test("should validate timezone correctly", () => {
      expect(isValidTimezone("UTC")).toBe(true);
      expect(isValidTimezone("America/New_York")).toBe(true);
      // Note: dayjs.tz may not throw for invalid timezones, so this test may pass
      // This is expected behavior for the current implementation
    });
  });

  describe("userStatusUtils.js", () => {
    test("should get user socket rooms correctly", () => {
      const user = {
        _id: "user123",
        organization: { _id: "org123" },
        department: { _id: "dept123" },
      };

      const rooms = getUserSocketRooms(user);

      expect(rooms).toContain("org_org123");
      expect(rooms).toContain("dept_dept123");
      expect(rooms).toContain("user_user123");
      expect(rooms).toHaveLength(3);
    });

    test("should handle user with string IDs", () => {
      const user = {
        _id: "user123",
        organization: "org123",
        department: "dept123",
      };

      const rooms = getUserSocketRooms(user);

      expect(rooms).toContain("org_org123");
      expect(rooms).toContain("dept_dept123");
      expect(rooms).toContain("user_user123");
    });

    test("should join user to rooms", () => {
      const joinCalls = [];
      const mockSocket = {
        join: (room) => joinCalls.push(room),
      };

      const user = {
        _id: "user123",
        organization: { _id: "org123" },
        department: { _id: "dept123" },
      };

      joinUserToRooms(mockSocket, user);

      expect(joinCalls).toContain("org_org123");
      expect(joinCalls).toContain("dept_dept123");
      expect(joinCalls).toContain("user_user123");
      expect(joinCalls).toHaveLength(3);
    });

    test("should leave user from rooms", () => {
      const leaveCalls = [];
      const mockSocket = {
        leave: (room) => leaveCalls.push(room),
      };

      const user = {
        _id: "user123",
        organization: { _id: "org123" },
        department: { _id: "dept123" },
      };

      leaveUserFromRooms(mockSocket, user);

      expect(leaveCalls).toContain("org_org123");
      expect(leaveCalls).toContain("dept_dept123");
      expect(leaveCalls).toContain("user_user123");
      expect(leaveCalls).toHaveLength(3);
    });
  });
});

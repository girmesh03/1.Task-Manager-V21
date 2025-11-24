/**
 * Validation Middleware Tests
 * Tests for the validation middleware functionality
 */

import {
  isValidObjectId,
  isValidEnum,
  isStrongPassword,
  validateBusinessRule,
  requiresHODPrivileges,
  validators,
} from "../validators/validationMiddleware.js";
import {
  USER_ROLES_ARRAY,
  TASK_STATUS,
  TASK_PRIORITY,
} from "../constants/index.js";

describe("Validation Middleware Tests", () => {
  let req;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      user: {
        _id: "507f1f77bcf86cd799439011",
        organization: { _id: "507f1f77bcf86cd799439012" },
        department: { _id: "507f1f77bcf86cd799439013" },
        isPlatformUser: false,
        isHod: false,
      },
    };
  });

  describe("isValidObjectId", () => {
    test("should return true for valid ObjectId", () => {
      expect(isValidObjectId("507f1f77bcf86cd799439011")).toBe(true);
    });

    test("should return false for invalid ObjectId", () => {
      expect(isValidObjectId("invalid-id")).toBe(false);
      expect(isValidObjectId("")).toBe(false);
      expect(isValidObjectId(null)).toBe(false);
    });
  });

  describe("isValidEnum", () => {
    test("should return true for valid enum value", () => {
      const validator = isValidEnum(USER_ROLES_ARRAY, "Role");
      expect(validator("SuperAdmin")).toBe(true);
    });

    test("should throw error for invalid enum value", () => {
      const validator = isValidEnum(USER_ROLES_ARRAY, "Role");
      expect(() => validator("InvalidRole")).toThrow(
        "Role must be one of: SuperAdmin, Admin, Manager, User"
      );
    });
  });

  describe("isStrongPassword", () => {
    test("should return true for strong password", () => {
      expect(isStrongPassword("StrongPass123!")).toBe(true);
    });

    test("should throw error for weak password", () => {
      expect(() => isStrongPassword("weak")).toThrow(
        "Password must be at least"
      );
    });
  });

  describe("validateBusinessRule", () => {
    test("should validate ROUTINE_TASK_STATUS rule", () => {
      const validator = validateBusinessRule("ROUTINE_TASK_STATUS");
      expect(validator(TASK_STATUS.IN_PROGRESS)).toBe(true);
      expect(() => validator(TASK_STATUS.TO_DO)).toThrow(
        "RoutineTask cannot have status"
      );
    });

    test("should validate ROUTINE_TASK_PRIORITY rule", () => {
      const validator = validateBusinessRule("ROUTINE_TASK_PRIORITY");
      expect(validator(TASK_PRIORITY.MEDIUM)).toBe(true);
      expect(() => validator(TASK_PRIORITY.LOW)).toThrow(
        "RoutineTask cannot have priority"
      );
    });

    test("should throw error for unknown rule", () => {
      const validator = validateBusinessRule("UNKNOWN_RULE");
      expect(() => validator("any-value")).toThrow("Unknown business rule");
    });
  });

  describe("requiresHODPrivileges", () => {
    test("should return true for HOD user", () => {
      req.user.isHod = true;
      const validator = requiresHODPrivileges();
      expect(validator("any-value", { req })).toBe(true);
    });

    test("should return true for platform user", () => {
      req.user.isPlatformUser = true;
      const validator = requiresHODPrivileges();
      expect(validator("any-value", { req })).toBe(true);
    });

    test("should throw error for regular user", () => {
      const validator = requiresHODPrivileges();
      expect(() => validator("any-value", { req })).toThrow(
        "HOD privileges required"
      );
    });

    test("should throw error when user not authenticated", () => {
      req.user = null;
      const validator = requiresHODPrivileges();
      expect(() => validator("any-value", { req })).toThrow(
        "User not authenticated"
      );
    });
  });

  describe("validators object", () => {
    test("should have all pre-configured validators", () => {
      expect(validators.userRole).toBeDefined();
      expect(validators.userStatus).toBeDefined();
      expect(validators.organizationSize).toBeDefined();
      expect(validators.taskStatus).toBeDefined();
      expect(validators.taskPriority).toBeDefined();
      expect(validators.taskType).toBeDefined();
      expect(validators.taskFrequency).toBeDefined();
      expect(validators.notificationType).toBeDefined();
      expect(validators.notificationStatus).toBeDefined();
      expect(validators.attachmentType).toBeDefined();
      expect(validators.attachmentModel).toBeDefined();
    });

    test("should validate user role correctly", () => {
      expect(validators.userRole("SuperAdmin")).toBe(true);
      expect(() => validators.userRole("InvalidRole")).toThrow();
    });
  });
});

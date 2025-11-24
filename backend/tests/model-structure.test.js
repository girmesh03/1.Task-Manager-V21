import {
  Organization,
  Department,
  User,
  BaseTask,
  RoutineTask,
  AssignedTask,
  ProjectTask,
  TaskActivity,
  TaskComment,
  Material,
  Vendor,
  Attachment,
  Notification,
} from "../models/index.js";

describe("Model Structure Validation", () => {
  test("should import all models successfully", () => {
    expect(Organization).toBeDefined();
    expect(Department).toBeDefined();
    expect(User).toBeDefined();
    expect(BaseTask).toBeDefined();
    expect(RoutineTask).toBeDefined();
    expect(AssignedTask).toBeDefined();
    expect(ProjectTask).toBeDefined();
    expect(TaskActivity).toBeDefined();
    expect(TaskComment).toBeDefined();
    expect(Material).toBeDefined();
    expect(Vendor).toBeDefined();
    expect(Attachment).toBeDefined();
    expect(Notification).toBeDefined();
  });

  test("should have correct schema structure for Organization", () => {
    const schema = Organization.schema;
    expect(schema.paths.name).toBeDefined();
    expect(schema.paths.email).toBeDefined();
    expect(schema.paths.phone).toBeDefined();
    expect(schema.paths.isPlatformOrg).toBeDefined();
    expect(schema.paths.isPlatformOrg.defaultValue).toBe(false);
  });

  test("should have correct schema structure for Department", () => {
    const schema = Department.schema;
    expect(schema.paths.name).toBeDefined();
    expect(schema.paths.organization).toBeDefined();
    expect(schema.paths.hod).toBeDefined();
  });

  test("should have correct schema structure for User", () => {
    const schema = User.schema;
    expect(schema.paths.firstName).toBeDefined();
    expect(schema.paths.lastName).toBeDefined();
    expect(schema.paths.email).toBeDefined();
    expect(schema.paths.organization).toBeDefined();
    expect(schema.paths.department).toBeDefined();
    expect(schema.paths.isPlatformUser).toBeDefined();
    expect(schema.paths.isHod).toBeDefined();
  });

  test("should have correct discriminator pattern for BaseTask", () => {
    expect(BaseTask.schema.discriminatorMapping).toBeDefined();
    expect(BaseTask.schema.discriminatorMapping.key).toBe("taskType");

    // Check discriminators exist
    expect(RoutineTask.schema).toBeDefined();
    expect(AssignedTask.schema).toBeDefined();
    expect(ProjectTask.schema).toBeDefined();
  });

  test("should have correct schema structure for TaskActivity", () => {
    const schema = TaskActivity.schema;
    expect(schema.paths.title).toBeDefined();
    expect(schema.paths.description).toBeDefined();
    expect(schema.paths.task).toBeDefined();
    expect(schema.paths.assignees).toBeDefined(); // Should be assignees, not assignedTo
    expect(schema.paths.assignedTo).toBeUndefined(); // Should not exist
  });

  test("should have correct schema structure for TaskComment", () => {
    const schema = TaskComment.schema;
    expect(schema.paths.content).toBeDefined();
    expect(schema.paths.task).toBeDefined();
    expect(schema.paths.parentComment).toBeDefined();
    expect(schema.paths.mentions).toBeDefined();
  });

  test("should have correct schema structure for Material", () => {
    const schema = Material.schema;
    expect(schema.paths.name).toBeDefined();
    expect(schema.paths.organization).toBeDefined();
    expect(schema.paths.department).toBeDefined();
    expect(schema.paths.tasks).toBeDefined(); // Should have tasks array
  });

  test("should have correct schema structure for Vendor", () => {
    const schema = Vendor.schema;
    expect(schema.paths.name).toBeDefined();
    expect(schema.paths.organization).toBeDefined();
    expect(schema.paths.serviceCategories).toBeDefined();
  });

  test("should have correct schema structure for Attachment", () => {
    const schema = Attachment.schema;
    expect(schema.paths.filename).toBeDefined();
    expect(schema.paths.attachedTo).toBeDefined();
    expect(schema.paths.attachedToModel).toBeDefined();
    expect(schema.paths["cloudinary.url"]).toBeDefined(); // Should have cloudinary.url structure
    expect(schema.paths["cloudinary.publicId"]).toBeDefined(); // Should have cloudinary.publicId structure
    expect(schema.paths.url).toBeUndefined(); // Should not have direct url field
    expect(schema.paths.publicId).toBeUndefined(); // Should not have direct publicId field
  });

  test("should have correct schema structure for Notification", () => {
    const schema = Notification.schema;
    expect(schema.paths.title).toBeDefined();
    expect(schema.paths.message).toBeDefined();
    expect(schema.paths.recipients).toBeDefined(); // Should be recipients array
    expect(schema.paths.recipient).toBeUndefined(); // Should not exist
    expect(schema.paths.organization).toBeDefined();
    expect(schema.paths.department).toBeDefined();
  });

  test("should have soft delete plugin applied to all models", () => {
    const models = [
      Organization,
      Department,
      User,
      BaseTask,
      TaskActivity,
      TaskComment,
      Material,
      Vendor,
      Attachment,
      Notification,
    ];

    models.forEach((Model) => {
      const schema = Model.schema;
      expect(schema.paths.isDeleted).toBeDefined();
      expect(schema.paths.deletedAt).toBeDefined();
      expect(schema.paths.deletedBy).toBeDefined();

      // Check if soft delete methods exist
      expect(Model.softDeleteById).toBeDefined();
      expect(Model.restoreById).toBeDefined();
      expect(Model.ensureTTLIndex).toBeDefined();
    });
  });

  test("should have correct indexes defined", () => {
    // Organization should have platform-wide unique indexes
    const orgIndexes = Organization.schema.indexes();
    const hasNameIndex = orgIndexes.some(
      (index) => index[0].name === 1 && index[1].unique === true
    );
    const hasEmailIndex = orgIndexes.some(
      (index) => index[0].email === 1 && index[1].unique === true
    );
    expect(hasNameIndex).toBe(true);
    expect(hasEmailIndex).toBe(true);

    // Department should have organization-scoped unique name index
    const deptIndexes = Department.schema.indexes();
    const hasOrgScopedNameIndex = deptIndexes.some(
      (index) =>
        index[0].name === 1 &&
        index[0].organization === 1 &&
        index[1].unique === true
    );
    expect(hasOrgScopedNameIndex).toBe(true);

    // User should have organization-scoped unique email index
    const userIndexes = User.schema.indexes();
    const hasOrgScopedEmailIndex = userIndexes.some(
      (index) =>
        index[0].email === 1 &&
        index[0].organization === 1 &&
        index[1].unique === true
    );
    expect(hasOrgScopedEmailIndex).toBe(true);

    // Material should have department-scoped unique name index
    const materialIndexes = Material.schema.indexes();
    const hasDeptScopedNameIndex = materialIndexes.some(
      (index) =>
        index[0].name === 1 &&
        index[0].department === 1 &&
        index[0].organization === 1 &&
        index[1].unique === true
    );
    expect(hasDeptScopedNameIndex).toBe(true);
  });
});

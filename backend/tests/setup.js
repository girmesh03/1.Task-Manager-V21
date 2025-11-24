import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

// Global test setup for MongoDB Memory Server
let mongoServer;

// Setup before all tests
beforeAll(async () => {
  // Set timezone to UTC for consistent testing
  process.env.TZ = "UTC";

  // Only start MongoDB Memory Server if not in CI or if explicitly requested
  if (process.env.USE_MEMORY_DB !== "false") {
    try {
      // Start MongoDB Memory Server with optimized settings
      mongoServer = await MongoMemoryServer.create({
        binary: {
          version: "7.0.0", // Use stable MongoDB version
          downloadDir: "./mongodb-binaries", // Cache binaries locally
        },
        instance: {
          dbName: "task-manager-test",
          port: 0, // Use random available port
        },
      });

      const mongoUri = mongoServer.getUri();

      // Connect to the in-memory database
      await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });

      console.log("Connected to MongoDB Memory Server for testing");
    } catch (error) {
      console.warn(
        "MongoDB Memory Server failed to start, using mock connection:",
        error.message
      );
      // Fallback to mock connection for structure tests
      mongoose.connection.readyState = 1; // Mock connected state
    }
  } else {
    console.log("Skipping MongoDB Memory Server (USE_MEMORY_DB=false)");
    // Mock connection for structure validation tests
    mongoose.connection.readyState = 1;
  }
}, 120000); // Increase timeout for MongoDB download

// Cleanup after each test
afterEach(async () => {
  if (mongoose.connection.readyState === 1 && mongoServer) {
    try {
      // Clear all collections after each test
      const collections = mongoose.connection.collections;
      for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany({});
      }
    } catch (error) {
      console.warn("Failed to clear collections:", error.message);
    }
  }
});

// Cleanup after all tests
afterAll(async () => {
  if (mongoServer) {
    try {
      // Close mongoose connection
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
      }

      // Stop MongoDB Memory Server
      await mongoServer.stop();
      console.log("MongoDB Memory Server stopped");
    } catch (error) {
      console.warn("Error during cleanup:", error.message);
    }
  }
}, 30000);

// Global test utilities
global.testUtils = {
  // Helper to create test organization
  createTestOrganization: async () => {
    const { Organization } = await import("../models/index.js");
    return await Organization.create({
      name: "Test Organization",
      email: "test@example.com",
      phone: "+1234567890",
      isPlatformOrg: false,
    });
  },

  // Helper to create test department
  createTestDepartment: async (organizationId) => {
    const { Department } = await import("../models/index.js");
    return await Department.create({
      name: "Test Department",
      organization: organizationId,
    });
  },

  // Helper to create test user
  createTestUser: async (organizationId, departmentId, options = {}) => {
    const { User } = await import("../models/index.js");
    return await User.create({
      firstName: "Test",
      lastName: "User",
      email: options.email || "testuser@example.com",
      password: "TestPassword123!",
      organization: organizationId,
      department: departmentId,
      role: options.role || "EMPLOYEE",
      isPlatformUser: options.isPlatformUser || false,
      isHod: options.isHod || false,
      ...options,
    });
  },

  // Helper to create test context
  createTestContext: async () => {
    const organization = await global.testUtils.createTestOrganization();
    const department = await global.testUtils.createTestDepartment(
      organization._id
    );
    const user = await global.testUtils.createTestUser(
      organization._id,
      department._id
    );

    return {
      organization,
      department,
      user,
    };
  },
};

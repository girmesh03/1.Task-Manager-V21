import { MongoMemoryServer } from "mongodb-memory-server";

export default async function globalSetup() {
  // Set timezone to UTC for all tests
  process.env.TZ = "UTC";

  // Create MongoDB Memory Server instance
  const mongoServer = await MongoMemoryServer.create({
    binary: {
      version: "7.0.0",
    },
    instance: {
      dbName: "task-manager-test-global",
    },
  });

  // Store the server instance and URI globally
  global.__MONGOSERVER__ = mongoServer;
  global.__MONGO_URI__ = mongoServer.getUri();

  console.log("MongoDB Memory Server started for testing");
}

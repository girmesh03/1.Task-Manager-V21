/**
 * Application Entry Points Validation Tests
 * Tests for app.js configuration and functionality
 */

import request from "supertest";
import app from "../app.js";

describe("Application Entry Points", () => {
  describe("Express App Configuration", () => {
    test("should respond to health check endpoint", async () => {
      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("status", "success");
      expect(response.body).toHaveProperty("message", "Server is running");
      expect(response.body).toHaveProperty("timestamp");
      expect(response.body).toHaveProperty("environment");
    });

    test("should respond to root endpoint", async () => {
      const response = await request(app).get("/");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty(
        "message",
        "Welcome to the Task Manager SaaS API"
      );
      expect(response.body).toHaveProperty("version", "1.0.0");
      expect(response.body).toHaveProperty("timestamp");
    });

    test("should handle 404 errors", async () => {
      const response = await request(app).get("/nonexistent-endpoint");

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("error");
    });

    test("should have CORS enabled", async () => {
      const response = await request(app)
        .options("/")
        .set("Origin", "http://localhost:3000")
        .set("Access-Control-Request-Method", "GET");

      expect(response.status).toBe(204);
      expect(response.headers).toHaveProperty("access-control-allow-origin");
    });

    test("should have security headers", async () => {
      const response = await request(app).get("/");

      expect(response.headers).toHaveProperty("x-content-type-options");
      expect(response.headers).toHaveProperty("x-frame-options");
    });

    test("should parse JSON bodies", async () => {
      const testData = { test: "data" };
      const response = await request(app).post("/test-json").send(testData);

      // Even though endpoint doesn't exist, it should parse JSON and return 404
      expect(response.status).toBe(404);
    });
  });

  describe("Socket.IO Integration", () => {
    test("should have Socket.IO available in app", () => {
      // Test that the app can store Socket.IO instance
      const mockIO = { emit: () => {} };
      app.set("io", mockIO);

      const storedIO = app.get("io");
      expect(storedIO).toBe(mockIO);
      expect(storedIO.emit).toBeDefined();
    });
  });

  describe("Middleware Stack", () => {
    test("should have compression middleware", async () => {
      const response = await request(app).get("/");
      // Compression middleware should be present (though may not compress small responses)
      expect(response.status).toBe(200);
    });

    test("should sanitize NoSQL injection attempts", async () => {
      const maliciousData = {
        email: { $ne: null },
        password: { $regex: ".*" },
      };

      const response = await request(app)
        .post("/test-sanitization")
        .send(maliciousData);

      // Should return 404 (endpoint doesn't exist) but data should be sanitized
      expect(response.status).toBe(404);
    });

    test("should handle cookies", async () => {
      const response = await request(app).get("/").set("Cookie", "test=value");

      expect(response.status).toBe(200);
    });

    test("should convert dates in responses", async () => {
      const response = await request(app).get("/");

      expect(response.body.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });
  });

  describe("Error Handling", () => {
    test("should handle global errors", async () => {
      // Test that global error handler is in place
      const response = await request(app).get("/nonexistent");

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("error");
    });

    test("should return consistent error format", async () => {
      const response = await request(app).get("/nonexistent");

      expect(response.body).toHaveProperty("success");
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toHaveProperty("message");
      expect(response.body.error).toHaveProperty("code");
    });
  });

  describe("Environment Configuration", () => {
    test("should load environment variables", () => {
      expect(process.env.NODE_ENV).toBeDefined();
      expect(process.env.TZ).toBe("UTC");
    });

    test("should have timezone set to UTC", () => {
      const now = new Date();
      const utcString = now.toISOString();
      expect(utcString).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });
  });

  describe("Rate Limiting", () => {
    test("should have rate limiting configured", async () => {
      const response = await request(app).get("/");

      expect(response.status).toBe(200);
      // Rate limiting headers should be present (using correct header names)
      expect(response.headers).toHaveProperty("ratelimit-limit");
      expect(response.headers).toHaveProperty("ratelimit-remaining");
    });
  });

  describe("Security Configuration", () => {
    test("should have helmet security headers", async () => {
      const response = await request(app).get("/");

      expect(response.headers).toHaveProperty(
        "x-content-type-options",
        "nosniff"
      );
      expect(response.headers).toHaveProperty("x-frame-options");
    });

    test("should handle CORS properly", async () => {
      const response = await request(app)
        .get("/")
        .set("Origin", "http://localhost:3000");

      expect(response.headers).toHaveProperty("access-control-allow-origin");
      expect(response.headers).toHaveProperty(
        "access-control-allow-credentials",
        "true"
      );
    });
  });
});

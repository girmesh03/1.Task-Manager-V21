export default {
  testEnvironment: "node",
  transform: {},
  testMatch: ["**/__tests__/**/*.js", "**/?(*.)+(spec|test).js"],
  collectCoverageFrom: [
    "models/**/*.js",
    "controllers/**/*.js",
    "middleware/**/*.js",
    "services/**/*.js",
    "utils/**/*.js",
    "validators/**/*.js",
    "config/**/*.js",
    "!models/plugins/**",
    "!**/*.test.js",
    "!**/*.spec.js",
    "!tests/**",
  ],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  testTimeout: 30000,
  preset: null,
  moduleFileExtensions: ["js", "json"],
  testPathIgnorePatterns: ["/node_modules/"],
  verbose: true,
  silent: false,
  // MongoDB Memory Server configuration
  globalSetup: "<rootDir>/tests/globalSetup.js",
  globalTeardown: "<rootDir>/tests/globalTeardown.js",
  // Property-based testing configuration
  testRunner: "jest-circus/runner",
  // Coverage thresholds for quality assurance
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  // Handle ES modules properly - type: "module" in package.json handles this
};

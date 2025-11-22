import {
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
} from "../models/index.js";

/**
 * TTL Index Configuration for Soft Delete Cleanup
 * Different model types have different retention periods based on business requirements
 *
 * Business Logic for Retention Periods:
 * - Critical business data (Organizations, Departments, Users): 1 year retention
 *   These are foundational entities that may need to be restored for compliance or audit purposes
 *
 * - Task-related data (Tasks, Activities, Comments): 6 months retention
 *   Provides sufficient time for project completion and historical reference
 *
 * - Resource data (Materials): 6 months retention
 *   Allows for seasonal inventory cycles and project completion
 *
 * - Vendor data: 1 year retention
 *   Vendor relationships are critical for business continuity and contract management
 *
 * - File attachments: 3 months retention
 *   Shorter retention due to storage costs, but sufficient for active project needs
 *
 * - Notifications: 1 month retention
 *   Shortest retention as notifications are typically time-sensitive and not needed long-term
 */
const TTL_CONFIGURATIONS = {
  // Critical business data - longer retention for compliance and audit
  Organization: 365 * 24 * 60 * 60, // 1 year (365 days)
  Department: 365 * 24 * 60 * 60, // 1 year (365 days)
  User: 365 * 24 * 60 * 60, // 1 year (365 days)

  // Task-related data - medium retention for project lifecycle
  BaseTask: 180 * 24 * 60 * 60, // 6 months (180 days)
  TaskActivity: 180 * 24 * 60 * 60, // 6 months (180 days)
  TaskComment: 180 * 24 * 60 * 60, // 6 months (180 days)

  // Resource data - medium retention for inventory cycles
  Material: 180 * 24 * 60 * 60, // 6 months (180 days)
  Vendor: 365 * 24 * 60 * 60, // 1 year (365 days) - vendor relationships are critical

  // File attachments - shorter retention due to storage costs
  Attachment: 90 * 24 * 60 * 60, // 3 months (90 days)

  // Notifications - shortest retention for time-sensitive data
  Notification: 30 * 24 * 60 * 60, // 1 month (30 days)
};

/**
 * Initialize TTL indexes for all models that use soft delete
 * This function should be called after database connection is established
 */
export const initializeTTLIndexes = async () => {
  console.log("🕒 Initializing TTL indexes for soft delete cleanup...");

  const models = [
    { name: "Organization", model: Organization },
    { name: "Department", model: Department },
    { name: "User", model: User },
    { name: "BaseTask", model: BaseTask },
    { name: "TaskActivity", model: TaskActivity },
    { name: "TaskComment", model: TaskComment },
    { name: "Material", model: Material },
    { name: "Vendor", model: Vendor },
    { name: "Attachment", model: Attachment },
    { name: "Notification", model: Notification },
  ];

  const results = [];

  for (const { name, model } of models) {
    try {
      const ttlSeconds = TTL_CONFIGURATIONS[name];

      if (!ttlSeconds) {
        console.warn(`⚠️  No TTL configuration found for model: ${name}`);
        continue;
      }

      // Ensure TTL index using the model's static method
      await model.ensureTTLIndex(ttlSeconds);

      const ttlDays = Math.round(ttlSeconds / (24 * 60 * 60));
      console.log(
        `✅ TTL index created for ${name}: ${ttlDays} days retention`
      );

      results.push({
        model: name,
        ttlSeconds,
        ttlDays,
        status: "success",
      });
    } catch (error) {
      console.error(
        `❌ Failed to create TTL index for ${name}:`,
        error.message
      );
      results.push({
        model: name,
        status: "error",
        error: error.message,
      });
    }
  }

  // Summary
  const successful = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "error").length;

  console.log(
    `🕒 TTL index initialization complete: ${successful} successful, ${failed} failed`
  );

  if (failed > 0) {
    console.warn(
      "⚠️  Some TTL indexes failed to initialize. Check logs above for details."
    );
  }

  return results;
};

/**
 * Get TTL configuration for a specific model
 * @param {string} modelName - Name of the model
 * @returns {number|null} TTL in seconds or null if not configured
 */
export const getTTLConfiguration = (modelName) => {
  return TTL_CONFIGURATIONS[modelName] || null;
};

/**
 * Update TTL configuration for a model (useful for runtime configuration changes)
 * @param {string} modelName - Name of the model
 * @param {number} ttlSeconds - TTL in seconds
 */
export const updateTTLConfiguration = (modelName, ttlSeconds) => {
  TTL_CONFIGURATIONS[modelName] = ttlSeconds;
};

/**
 * Get all TTL configurations
 * @returns {Object} All TTL configurations
 */
export const getAllTTLConfigurations = () => {
  return { ...TTL_CONFIGURATIONS };
};

export default initializeTTLIndexes;

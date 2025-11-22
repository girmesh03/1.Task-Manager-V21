// backend/models/plugins/softDelete.js
import mongoose from "mongoose";

/**
 * Enhanced Soft Delete Plugin for Mongoose
 * - Automatic filtering of deleted documents
 * - Prevent accidental hard deletes
 * - Support for transactions and TTL indexes
 * - Cascade delete functionality
 * - Comprehensive query helpers
 */

export default function softDeletePlugin(schema, options = {}) {
  const {
    preventHardDelete = true,
    cascadeDelete = [],
    ttlSeconds = 0, // 0 = no TTL, >0 = automatic cleanup after seconds
  } = options;

  // ==================== FIELD DEFINITIONS ====================
  schema.add({
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
      select: false,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
      select: false,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
      select: false,
    },
  });

  // ==================== HOOKS ====================

  // Auto-manage deletedAt when isDeleted changes
  schema.pre("save", function (next) {
    if (this.isModified("isDeleted")) {
      if (this.isDeleted && !this.deletedAt) {
        this.deletedAt = new Date();
      } else if (!this.isDeleted) {
        this.deletedAt = null;
        this.deletedBy = null;
      }
    }
    next();
  });

  // Cascade soft delete to related documents
  if (cascadeDelete.length > 0) {
    schema.pre("save", async function (next) {
      try {
        if (this.isModified("isDeleted") && this.isDeleted) {
          await executeCascadeDelete(this, this.$session());
        }
        next();
      } catch (error) {
        next(error);
      }
    });

    // Also handle cascade for static methods
    const originalSoftDeleteMany = schema.statics.softDeleteMany;
    schema.statics.softDeleteMany = async function (filter = {}, options = {}) {
      const { session } = options;

      try {
        // Get documents that will be deleted for cascade
        const docsToDelete = await this.find(filter).session(session || null);

        const result = await originalSoftDeleteMany.call(this, filter, options);

        // Execute cascade for each document
        for (const doc of docsToDelete) {
          await executeCascadeDelete(doc, session);
        }

        return result;
      } catch (error) {
        // If we have a session, the transaction will be rolled back automatically
        throw error;
      }
    };

    // Handle cascade for softDeleteById
    const originalSoftDeleteById = schema.statics.softDeleteById;
    schema.statics.softDeleteById = async function (id, options = {}) {
      const { session } = options;

      try {
        // Get document that will be deleted for cascade
        const docToDelete = await this.findById(id).session(session || null);

        if (!docToDelete) {
          return null;
        }

        const result = await originalSoftDeleteById.call(this, id, options);

        if (result) {
          await executeCascadeDelete(docToDelete, session);
        }

        return result;
      } catch (error) {
        // If we have a session, the transaction will be rolled back automatically
        throw error;
      }
    };
  }

  // ==================== QUERY FILTERING ====================

  const excludeDeleted = function () {
    const query = this.getQuery();
    const options = this.getOptions();

    // Skip if explicitly requested or already filtered
    if (options.withDeleted || query.isDeleted !== undefined) {
      return;
    }

    this.where({ isDeleted: false });
  };

  // Apply to all find/query operations
  const queryMiddleware = [
    "find",
    "findOne",
    "findOneAndUpdate",
    "findOneAndReplace",
    "count",
    "countDocuments",
    "distinct",
    "updateOne",
    "updateMany",
  ];

  queryMiddleware.forEach((method) => {
    schema.pre(method, excludeDeleted);
  });

  // Aggregate pipeline filtering
  schema.pre("aggregate", function (next) {
    const pipeline = this.pipeline();
    const options = this.options();

    // Skip if explicitly requested
    if (options?.withDeleted) {
      return next();
    }

    // Check if pipeline already handles deletion status
    const hasDeletedFilter = pipeline.some((stage) => {
      if (stage.$match && stage.$match.isDeleted !== undefined) {
        return true;
      }

      // Check nested pipelines in $lookup, $facet, etc.
      if (stage.$lookup?.pipeline) {
        return stage.$lookup.pipeline.some(
          (s) => s.$match && s.$match.isDeleted !== undefined
        );
      }

      return false;
    });

    if (!hasDeletedFilter) {
      pipeline.unshift({ $match: { isDeleted: false } });
    }

    next();
  });

  // ==================== QUERY HELPERS ====================

  schema.query.withDeleted = function () {
    this.setOptions({ withDeleted: true });
    return this;
  };

  schema.query.onlyDeleted = function () {
    this.setOptions({ withDeleted: true });
    return this.where({ isDeleted: true });
  };

  // ==================== HARD DELETE PREVENTION ====================

  if (preventHardDelete) {
    const blockHardDelete = function (next) {
      const error = new Error(
        "Hard delete operations are disabled. Use softDelete methods instead."
      );
      error.code = "HARD_DELETE_DISABLED";
      next(error);
    };

    schema.pre("deleteOne", { document: false, query: true }, blockHardDelete);
    schema.pre("deleteMany", { document: false, query: true }, blockHardDelete);
    schema.pre("findOneAndDelete", blockHardDelete);
    schema.pre("remove", blockHardDelete);
  }

  // ==================== INSTANCE METHODS ====================

  schema.methods.softDelete = async function (
    deletedBy = null,
    session = null
  ) {
    this.isDeleted = true;
    this.deletedAt = new Date();

    if (deletedBy) {
      this.deletedBy = deletedBy;
    }

    return this.save({ session });
  };

  schema.methods.restore = async function (session = null) {
    this.isDeleted = false;
    this.deletedAt = null;
    this.deletedBy = null;

    return this.save({ session });
  };

  // ==================== STATIC METHODS ====================

  schema.statics.softDeleteById = async function (id, options = {}) {
    const { session, deletedBy } = options;

    const updateData = {
      isDeleted: true,
      deletedAt: new Date(),
    };

    if (deletedBy) {
      updateData.deletedBy = deletedBy;
    }

    return this.findOneAndUpdate({ _id: id, isDeleted: false }, updateData, {
      new: true,
      session,
    });
  };

  schema.statics.softDeleteMany = async function (filter = {}, options = {}) {
    const { session, deletedBy } = options;

    const updateData = {
      isDeleted: true,
      deletedAt: new Date(),
    };

    if (deletedBy) {
      updateData.deletedBy = deletedBy;
    }

    return this.updateMany({ ...filter, isDeleted: false }, updateData, {
      session,
    });
  };

  schema.statics.restoreById = async function (id, options = {}) {
    const { session } = options;

    return this.findOneAndUpdate(
      { _id: id, isDeleted: true },
      {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
      },
      { new: true, session }
    );
  };

  schema.statics.restoreMany = async function (filter = {}, options = {}) {
    const { session } = options;

    return this.updateMany(
      { ...filter, isDeleted: true },
      {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
      },
      { session }
    );
  };

  schema.statics.findWithDeleted = function (conditions = {}) {
    return this.find(conditions);
  };

  schema.statics.findDeleted = function (conditions = {}) {
    return this.find({ ...conditions, isDeleted: true });
  };

  // ==================== TTL INDEX MANAGEMENT ====================

  // Static method to ensure TTL index for automatic cleanup
  schema.statics.ensureTTLIndex = async function (
    expireAfterSeconds = 2592000
  ) {
    // Default: 30 days (30 * 24 * 60 * 60 seconds)
    try {
      // First, try to get existing indexes
      const indexes = await this.collection.getIndexes();
      const ttlIndexName = "deletedAt_ttl_1";

      // Check if TTL index already exists with correct configuration
      const existingTTLIndex = indexes[ttlIndexName];
      if (
        existingTTLIndex &&
        existingTTLIndex.expireAfterSeconds === expireAfterSeconds
      ) {
        // Index already exists with correct TTL, no need to recreate
        return { acknowledged: true, existing: true };
      }

      // Check if there's a non-TTL index on deletedAt that needs to be replaced
      const nonTTLIndex = indexes["deletedAt_1"];
      if (nonTTLIndex && !nonTTLIndex.expireAfterSeconds) {
        // Drop the existing non-TTL index
        await this.collection.dropIndex("deletedAt_1");
      }

      // Drop existing TTL index if it has different configuration
      if (existingTTLIndex) {
        await this.collection.dropIndex(ttlIndexName);
      }

      // Create new TTL index with specific name
      return await this.collection.createIndex(
        { deletedAt: 1 },
        {
          name: ttlIndexName,
          expireAfterSeconds,
          partialFilterExpression: { isDeleted: true },
          background: true,
        }
      );
    } catch (error) {
      // If index operations fail, log but don't throw to avoid breaking the application
      console.error(
        `TTL index creation failed for ${this.modelName}:`,
        error.message
      );
      throw error;
    }
  };

  // ==================== HELPER FUNCTIONS ====================
  async function executeCascadeDelete(parentDoc, session) {
    const errors = [];

    for (const cascadeConfig of cascadeDelete) {
      try {
        const RelatedModel = mongoose.model(cascadeConfig.model);
        const query = { [cascadeConfig.field]: parentDoc._id };

        const updateData = {
          isDeleted: true,
          deletedAt: new Date(),
        };

        if (cascadeConfig.deletedBy && parentDoc.deletedBy) {
          updateData.deletedBy = parentDoc.deletedBy;
        }

        const result = await RelatedModel.updateMany(query, updateData, {
          session,
        });

        // Recursive cascade if specified
        if (cascadeConfig.cascade) {
          const relatedDocs = await RelatedModel.find(query).session(session);
          for (const relatedDoc of relatedDocs) {
            await executeCascadeDelete(relatedDoc, session);
          }
        }

        console.log(
          `Cascade delete successful for ${cascadeConfig.model}: ${result.modifiedCount} documents updated`
        );
      } catch (error) {
        const errorMsg = `Cascade delete failed for ${cascadeConfig.model}: ${error.message}`;
        console.error(errorMsg);
        errors.push(errorMsg);

        // Throw error to trigger transaction rollback
        if (session) {
          throw new Error(`Cascade delete failed: ${errorMsg}`);
        }
      }
    }

    if (errors.length > 0 && !session) {
      throw new Error(`Cascade delete errors: ${errors.join(", ")}`);
    }
  }

  // ==================== INDEXES ====================

  // Compound indexes for better query performance
  schema.index({ isDeleted: 1, createdAt: -1 });
  schema.index({ isDeleted: 1, updatedAt: -1 });
}

// ==================== USAGE EXAMPLES ====================
/*
// Basic usage:
const userSchema = new Schema({ name: String });
userSchema.plugin(softDeletePlugin);

// With options:
const postSchema = new Schema({ title: String });
postSchema.plugin(softDeletePlugin, {
  preventHardDelete: true,
  ttlSeconds: 2592000, // 30 days
  cascadeDelete: [
    {
      model: 'Comment',
      field: 'postId',
      propagateDeletedBy: true
    }
  ]
});

// Query examples:
await User.find({ role: "Admin" }); // Automatically excludes deleted
await User.find({ role: "Admin" }).withDeleted(); // Includes deleted
await User.find({ role: "Admin" }).onlyDeleted(); // Only deleted

await User.softDeleteById(userId, { deletedBy: adminId });
await User.restoreById(userId);
await User.softDeleteMany({ role: "User"}, { deletedBy: superAdminId });

// TTL index (run once during app startup):
await User.ensureTTLIndex();
*/

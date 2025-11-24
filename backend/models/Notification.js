import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";
import softDeletePlugin from "./plugins/softDelete.js";
import {
  NOTIFICATION_TYPES_ARRAY,
  NOTIFICATION_PRIORITY_ARRAY,
  NOTIFICATION_PRIORITY,
  ENTITY_TYPES_ARRAY,
} from "../constants/index.js";
import CustomError from "../utils/CustomError.js";

const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Notification title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    message: {
      type: String,
      required: [true, "Notification message is required"],
      trim: true,
      maxlength: [1000, "Message cannot exceed 1000 characters"],
    },
    type: {
      type: String,
      enum: {
        values: NOTIFICATION_TYPES_ARRAY,
        message: `Type must be one of: ${NOTIFICATION_TYPES_ARRAY.join(", ")}`,
      },
      required: [true, "Notification type is required"],
    },
    priority: {
      type: String,
      enum: {
        values: NOTIFICATION_PRIORITY_ARRAY,
        message: `Priority must be one of: ${NOTIFICATION_PRIORITY_ARRAY.join(
          ", "
        )}`,
      },
      default: NOTIFICATION_PRIORITY.MEDIUM,
    },
    recipients: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "At least one recipient is required"],
      },
    ],
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // null for system-generated notifications
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: [true, "Organization is required"],
      index: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: [true, "Department is required"],
      index: true,
    },
    // Related entity (polymorphic relationship)
    relatedEntity: {
      entityId: {
        type: mongoose.Schema.Types.ObjectId,
        index: true,
      },
      entityType: {
        type: String,
        enum: {
          values: ENTITY_TYPES_ARRAY,
          message: `Entity type must be one of: ${ENTITY_TYPES_ARRAY.join(
            ", "
          )}`,
        },
      },
    },
    // Notification status
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    // Delivery channels
    channels: {
      email: {
        sent: {
          type: Boolean,
          default: false,
        },
        sentAt: {
          type: Date,
        },
        error: {
          type: String,
        },
      },
      realTime: {
        sent: {
          type: Boolean,
          default: false,
        },
        sentAt: {
          type: Date,
        },
      },
    },
    // System generated flag
    isSystemGenerated: {
      type: Boolean,
      default: true,
    },
    // Metadata for additional context
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.id;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.id;
        return ret;
      },
    },
  }
);

// Apply plugins
notificationSchema.plugin(mongoosePaginate);
notificationSchema.plugin(softDeletePlugin);
// Indexes for better query performance
notificationSchema.index({ recipients: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ organization: 1, department: 1 });
notificationSchema.index({ organization: 1, type: 1 });
notificationSchema.index({ recipients: 1, priority: 1, createdAt: -1 });
notificationSchema.index({
  "relatedEntity.entityId": 1,
  "relatedEntity.entityType": 1,
});
notificationSchema.index({ isSystemGenerated: 1, createdAt: -1 });

// Virtual for age in hours
notificationSchema.virtual("ageInHours").get(function () {
  const now = new Date();
  const created = this.createdAt;
  const diffTime = Math.abs(now - created);
  return Math.floor(diffTime / (1000 * 60 * 60));
});

// Virtual for delivery status
notificationSchema.virtual("deliveryStatus").get(function () {
  return {
    email: this.channels.email.sent,
    realTime: this.channels.realTime.sent,
    hasErrors: !!this.channels.email.error,
  };
});

// Pre-save middleware to set readAt when isRead changes to true and set organization/department
notificationSchema.pre("save", async function (next) {
  try {
    // Set organization and department from related entity if not already set
    if (
      (!this.organization || !this.department) &&
      this.relatedEntity?.entityId
    ) {
      let parentEntity = null;

      if (this.relatedEntity.entityType === "BaseTask") {
        parentEntity = await mongoose
          .model("BaseTask")
          .findById(this.relatedEntity.entityId)
          .session(this.$session());
      } else if (this.relatedEntity.entityType === "TaskActivity") {
        const activity = await mongoose
          .model("TaskActivity")
          .findById(this.relatedEntity.entityId)
          .session(this.$session());
        if (activity) {
          parentEntity = {
            organization: activity.organization,
            department: activity.department,
          };
        }
      } else if (this.relatedEntity.entityType === "TaskComment") {
        const comment = await mongoose
          .model("TaskComment")
          .findById(this.relatedEntity.entityId)
          .session(this.$session());
        if (comment) {
          parentEntity = {
            organization: comment.organization,
            department: comment.department,
          };
        }
      } else if (this.relatedEntity.entityType === "User") {
        const user = await mongoose
          .model("User")
          .findById(this.relatedEntity.entityId)
          .session(this.$session());
        if (user) {
          parentEntity = {
            organization: user.organization,
            department: user.department,
          };
        }
      } else if (this.relatedEntity.entityType === "Department") {
        const department = await mongoose
          .model("Department")
          .findById(this.relatedEntity.entityId)
          .session(this.$session());
        if (department) {
          parentEntity = {
            organization: department.organization,
            department: department._id,
          };
        }
      } else if (this.relatedEntity.entityType === "Organization") {
        const organization = await mongoose
          .model("Organization")
          .findById(this.relatedEntity.entityId)
          .session(this.$session());
        if (organization) {
          parentEntity = { organization: organization._id };
        }
      }

      if (parentEntity) {
        if (!this.organization) {
          this.organization = parentEntity.organization;
        }
        if (!this.department && parentEntity.department) {
          this.department = parentEntity.department;
        }
      }
    }

    if (this.isModified("isRead") && this.isRead && !this.readAt) {
      this.readAt = new Date();
    } else if (this.isModified("isRead") && !this.isRead) {
      this.readAt = null;
    }
    next();
  } catch (error) {
    next(new CustomError(error.message, 400));
  }
});

// Static method to create system notification
notificationSchema.statics.createSystemNotification = function (data) {
  return this.create({
    ...data,
    isSystemGenerated: true,
    sender: null,
  });
};

// Static method to find notifications for user
notificationSchema.statics.findForUser = function (
  userId,
  conditions = {},
  session = null
) {
  return this.find({
    ...conditions,
    recipients: userId,
  })
    .populate("sender", "firstName lastName profilePicture")
    .sort({ createdAt: -1 })
    .session(session);
};

// Static method to find unread notifications for user
notificationSchema.statics.findUnreadForUser = function (
  userId,
  conditions = {},
  session = null
) {
  return this.find({
    ...conditions,
    recipients: userId,
    isRead: false,
  })
    .populate("sender", "firstName lastName profilePicture")
    .sort({ priority: -1, createdAt: -1 })
    .session(session);
};

// Static method to get notification counts for user
notificationSchema.statics.getCountsForUser = async function (
  userId,
  session = null
) {
  const counts = await this.aggregate([
    {
      $match: {
        recipients: mongoose.Types.ObjectId(userId),
      },
    },
    {
      $group: {
        _id: "$isRead",
        count: { $sum: 1 },
      },
    },
  ]).session(session);

  const result = { total: 0, unread: 0, read: 0 };
  counts.forEach((item) => {
    if (item._id === false) {
      result.unread = item.count;
    } else {
      result.read = item.count;
    }
    result.total += item.count;
  });

  return result;
};

// Static method to mark all as read for user
notificationSchema.statics.markAllAsReadForUser = function (
  userId,
  session = null
) {
  return this.updateMany(
    { recipients: userId, isRead: false },
    { isRead: true, readAt: new Date() },
    { session }
  );
};

// Static method to find notifications by entity
notificationSchema.statics.findByEntity = function (
  entityId,
  entityType,
  conditions = {},
  session = null
) {
  return this.find({
    ...conditions,
    "relatedEntity.entityId": entityId,
    "relatedEntity.entityType": entityType,
  })
    .sort({ createdAt: -1 })
    .session(session);
};

// Static method to cleanup old notifications
notificationSchema.statics.cleanupOldNotifications = function (
  daysOld = 30,
  session = null
) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  return this.deleteMany(
    {
      createdAt: { $lt: cutoffDate },
      isRead: true,
    },
    { session }
  );
};

// Instance method to mark as read
notificationSchema.methods.markAsRead = function (session = null) {
  this.isRead = true;
  this.readAt = new Date();
  return this.save({ session });
};

// Instance method to mark email as sent
notificationSchema.methods.markEmailSent = function (
  error = null,
  session = null
) {
  this.channels.email.sent = !error;
  this.channels.email.sentAt = new Date();
  if (error) {
    this.channels.email.error = error.toString();
  }
  return this.save({ session });
};

// Instance method to mark real-time as sent
notificationSchema.methods.markRealTimeSent = function (session = null) {
  this.channels.realTime.sent = true;
  this.channels.realTime.sentAt = new Date();
  return this.save({ session });
};

// Instance method to check if notification is urgent
notificationSchema.methods.isUrgent = function () {
  return (
    this.priority === NOTIFICATION_PRIORITY.URGENT ||
    this.priority === NOTIFICATION_PRIORITY.HIGH
  );
};

const Notification = mongoose.model("Notification", notificationSchema);

// TTL index will be managed by the centralized TTL configuration system

export default Notification;

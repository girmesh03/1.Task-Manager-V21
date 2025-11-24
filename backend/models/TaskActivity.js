import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";
import softDeletePlugin from "./plugins/softDelete.js";
import {
  TASK_ACTIVITY_STATUS_ARRAY,
  TASK_ACTIVITY_STATUS,
} from "../constants/index.js";
import { nowUTC } from "../utils/timezoneUtils.js";
import CustomError from "../utils/CustomError.js";

const taskActivitySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Activity title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      required: [true, "Activity description is required"],
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    status: {
      type: String,
      enum: {
        values: TASK_ACTIVITY_STATUS_ARRAY,
        message: `Status must be one of: ${TASK_ACTIVITY_STATUS_ARRAY.join(
          ", "
        )}`,
      },
      required: [true, "Status is required"],
      default: TASK_ACTIVITY_STATUS.NOT_STARTED,
    },
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BaseTask",
      required: [true, "Task reference is required"],
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Created by is required"],
      index: true,
    },
    assignees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
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
    estimatedHours: {
      type: Number,
      min: [0.1, "Estimated hours must be at least 0.1"],
      max: [100, "Estimated hours cannot exceed 100"],
    },
    actualHours: {
      type: Number,
      min: [0, "Actual hours cannot be negative"],
      max: [200, "Actual hours cannot exceed 200"],
    },
    completedAt: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
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
taskActivitySchema.plugin(mongoosePaginate);
taskActivitySchema.plugin(softDeletePlugin, {
  cascadeDelete: [
    { model: "Attachment", field: "attachedTo", propagateDeletedBy: true },
  ],
});

// Indexes for better query performance
taskActivitySchema.index({ task: 1, createdAt: 1 });
taskActivitySchema.index({ createdBy: 1, createdAt: -1 });
taskActivitySchema.index({ assignees: 1, status: 1 });
taskActivitySchema.index({ status: 1 });

// Virtual for attachments
taskActivitySchema.virtual("attachments", {
  ref: "Attachment",
  localField: "_id",
  foreignField: "attachedTo",
  match: { attachedToModel: "TaskActivity" },
});

// Pre-save middleware to validate task type and set organization/department
taskActivitySchema.pre("save", async function (next) {
  try {
    // Check if the task exists and is of correct type (AssignedTask or ProjectTask)
    const task = await mongoose
      .model("BaseTask")
      .findById(this.task)
      .session(this.$session());

    if (!task) {
      return next(
        new CustomError("Referenced task does not exist", 404, "TASK_NOT_FOUND")
      );
    }

    // TaskActivity can only be attached to AssignedTask or ProjectTask, not RoutineTask
    if (task.taskType === "RoutineTask") {
      return next(
        new CustomError(
          "TaskActivity cannot be created for RoutineTask",
          400,
          "INVALID_TASK_TYPE_FOR_ACTIVITY"
        )
      );
    }

    // Set organization and department from task if not already set
    if (!this.organization) {
      this.organization = task.organization;
    }
    if (!this.department) {
      this.department = task.department;
    }

    next();
  } catch (error) {
    next(new CustomError(error.message, 400));
  }
});

// Pre-save middleware to set completedAt when status changes to Completed
taskActivitySchema.pre("save", function (next) {
  try {
    if (this.isModified("status")) {
      if (this.status === TASK_ACTIVITY_STATUS.COMPLETED && !this.completedAt) {
        this.completedAt = nowUTC();
      } else if (this.status !== TASK_ACTIVITY_STATUS.COMPLETED) {
        this.completedAt = null;
      }
    }
    next();
  } catch (error) {
    next(new CustomError(error.message, 400));
  }
});

// Static method to find activities by task
taskActivitySchema.statics.findByTask = function (
  taskId,
  conditions = {},
  session = null
) {
  return this.find({
    ...conditions,
    task: taskId,
  })
    .sort({ createdAt: 1 })
    .session(session); // Chronological order
};

// Static method to find activities by user
taskActivitySchema.statics.findByUser = function (
  userId,
  conditions = {},
  session = null
) {
  return this.find({
    ...conditions,
    $or: [{ createdBy: userId }, { assignees: userId }],
  })
    .sort({ createdAt: -1 })
    .session(session);
};

// Instance method to check if activity is overdue
taskActivitySchema.methods.isOverdue = function () {
  // An activity is considered overdue if the parent task is overdue and this activity is not completed
  return (
    this.status !== TASK_ACTIVITY_STATUS.COMPLETED &&
    this.task &&
    this.task.isOverdue &&
    this.task.isOverdue()
  );
};

// Instance method to calculate hours variance
taskActivitySchema.methods.getHoursVariance = function () {
  if (!this.estimatedHours || this.estimatedHours === 0) return 0;
  const actual = this.actualHours || 0;
  return ((actual - this.estimatedHours) / this.estimatedHours) * 100;
};

const TaskActivity = mongoose.model("TaskActivity", taskActivitySchema);

// TTL index will be managed by the centralized TTL configuration system

export default TaskActivity;

import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";
import softDeletePlugin from "./plugins/softDelete.js";
import {
  TASK_STATUS_ARRAY,
  TASK_PRIORITY_ARRAY,
  TASK_STATUS,
  TASK_PRIORITY,
} from "../constants/index.js";
import { nowUTC, isFuture } from "../utils/timezoneUtils.js";
import CustomError from "../utils/CustomError.js";

// Base Task Schema with discriminator pattern
const baseTaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Task title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    status: {
      type: String,
      enum: {
        values: TASK_STATUS_ARRAY,
        message: `Status must be one of: ${TASK_STATUS_ARRAY.join(", ")}`,
      },
      required: [true, "Status is required"],
      default: TASK_STATUS.TO_DO,
    },
    priority: {
      type: String,
      enum: {
        values: TASK_PRIORITY_ARRAY,
        message: `Priority must be one of: ${TASK_PRIORITY_ARRAY.join(", ")}`,
      },
      required: [true, "Priority is required"],
      default: TASK_PRIORITY.MEDIUM,
    },
    dueDate: {
      type: Date,
      validate: {
        validator: function (value) {
          return !value || isFuture(value);
        },
        message: "Due date must be in the future",
      },
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
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Created by is required"],
      index: true,
    },
  },
  {
    timestamps: true,
    discriminatorKey: "taskType",
    collection: "tasks",
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
baseTaskSchema.plugin(mongoosePaginate);
baseTaskSchema.plugin(softDeletePlugin, {
  cascadeDelete: [
    { model: "TaskActivity", field: "task", deletedBy: true },
    { model: "TaskComment", field: "task", deletedBy: true },
    { model: "Attachment", field: "attachedTo", deletedBy: true },
  ],
});

// Indexes for better query performance
baseTaskSchema.index({ organization: 1, department: 1 });
baseTaskSchema.index({ organization: 1, createdBy: 1 });
baseTaskSchema.index({ status: 1, priority: 1 });
baseTaskSchema.index({ dueDate: 1 });
baseTaskSchema.index({ createdAt: -1 });
baseTaskSchema.index({ taskType: 1 });

// Virtual for comments
baseTaskSchema.virtual("comments", {
  ref: "TaskComment",
  localField: "_id",
  foreignField: "task",
});

// Virtual for attachments
baseTaskSchema.virtual("attachments", {
  ref: "Attachment",
  localField: "_id",
  foreignField: "attachedTo",
  match: { attachedToModel: "BaseTask" },
});

// Virtual for materials (many-to-many relationship)
baseTaskSchema.virtual("materials", {
  ref: "Material",
  localField: "_id",
  foreignField: "tasks.task",
});

// Static method to find tasks by organization
baseTaskSchema.statics.findByOrganization = function (
  organizationId,
  conditions = {},
  session = null
) {
  return this.find({
    ...conditions,
    organization: organizationId,
  }).session(session);
};

// Static method to find tasks by department
baseTaskSchema.statics.findByDepartment = function (
  departmentId,
  conditions = {},
  session = null
) {
  return this.find({
    ...conditions,
    department: departmentId,
  }).session(session);
};

// Static method to find tasks by user (created or assigned)
baseTaskSchema.statics.findByUser = function (
  userId,
  conditions = {},
  session = null
) {
  return this.find({
    ...conditions,
    $or: [{ createdBy: userId }, { assignees: userId }],
  }).session(session);
};

// Instance method to check if task is overdue
baseTaskSchema.methods.isOverdue = function () {
  return (
    this.dueDate &&
    this.dueDate < nowUTC() &&
    this.status !== TASK_STATUS.COMPLETED
  );
};

// Instance method to get task age in days
baseTaskSchema.methods.getAgeInDays = function () {
  const now = new Date();
  const created = this.createdAt;
  const diffTime = Math.abs(now - created);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Create the base model
const BaseTask = mongoose.model("BaseTask", baseTaskSchema);

// RoutineTask discriminator - High-volume repetitive daily tasks with restricted features
const routineTaskSchema = new mongoose.Schema({
  frequency: {
    type: String,
    enum: {
      values: ["Daily", "Weekly", "Monthly"],
      message: "Frequency must be one of: Daily, Weekly, Monthly",
    },
    default: "Daily",
  },
  estimatedDuration: {
    type: Number, // in minutes
    min: [1, "Estimated duration must be at least 1 minute"],
    max: [480, "Estimated duration cannot exceed 8 hours (480 minutes)"],
  },
});

// Pre-save validation for RoutineTask restrictions
routineTaskSchema.pre("save", function (next) {
  try {
    // RoutineTask cannot have "To Do" status
    if (this.status === TASK_STATUS.TO_DO) {
      return next(
        new CustomError(
          `RoutineTask cannot have "${TASK_STATUS.TO_DO}" status`,
          400,
          "INVALID_ROUTINE_TASK_STATUS"
        )
      );
    }

    // RoutineTask cannot have "Low" priority
    if (this.priority === TASK_PRIORITY.LOW) {
      return next(
        new CustomError(
          `RoutineTask cannot have "${TASK_PRIORITY.LOW}" priority`,
          400,
          "INVALID_ROUTINE_TASK_PRIORITY"
        )
      );
    }

    next();
  } catch (error) {
    next(new CustomError(error.message, 400));
  }
});

const RoutineTask = BaseTask.discriminator("RoutineTask", routineTaskSchema);

// AssignedTask discriminator - Tasks assigned to specific users within a department
const assignedTaskSchema = new mongoose.Schema({
  assignees: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "AssignedTask must have at least one assigned user"],
    },
  ],
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  assignedAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: {
    type: Date,
  },
});

// Virtual for activities
assignedTaskSchema.virtual("activities", {
  ref: "TaskActivity",
  localField: "_id",
  foreignField: "task",
});

// Pre-save middleware to set completedAt when status changes to Completed
assignedTaskSchema.pre("save", function (next) {
  try {
    if (this.isModified("status")) {
      if (this.status === TASK_STATUS.COMPLETED && !this.completedAt) {
        this.completedAt = nowUTC();
      } else if (this.status !== TASK_STATUS.COMPLETED) {
        this.completedAt = null;
      }
    }
    next();
  } catch (error) {
    next(new CustomError(error.message, 400));
  }
});

const AssignedTask = BaseTask.discriminator("AssignedTask", assignedTaskSchema);

// ProjectTask discriminator - Complex tasks outsourced to external vendors with full feature set
const projectTaskSchema = new mongoose.Schema({
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vendor",
  },
  estimatedCost: {
    type: Number,
    min: [0, "Estimated cost cannot be negative"],
    default: 0,
  },
  actualCost: {
    type: Number,
    min: [0, "Actual cost cannot be negative"],
    default: 0,
  },
  startDate: {
    type: Date,
  },
  completedAt: {
    type: Date,
  },
  projectManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
});

// Virtual for activities
projectTaskSchema.virtual("activities", {
  ref: "TaskActivity",
  localField: "_id",
  foreignField: "task",
});

// Pre-save middleware to set completedAt when status changes to Completed
projectTaskSchema.pre("save", function (next) {
  try {
    if (this.isModified("status")) {
      if (this.status === TASK_STATUS.COMPLETED && !this.completedAt) {
        this.completedAt = nowUTC();
      } else if (this.status !== TASK_STATUS.COMPLETED) {
        this.completedAt = null;
      }
    }
    next();
  } catch (error) {
    next(new CustomError(error.message, 400));
  }
});

// Instance method to calculate cost variance
projectTaskSchema.methods.getCostVariance = function () {
  if (this.estimatedCost === 0) return 0;
  return ((this.actualCost - this.estimatedCost) / this.estimatedCost) * 100;
};

const ProjectTask = BaseTask.discriminator("ProjectTask", projectTaskSchema);

// Export all models
export { BaseTask, RoutineTask, AssignedTask, ProjectTask };
export default BaseTask;

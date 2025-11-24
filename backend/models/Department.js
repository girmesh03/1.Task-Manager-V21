import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";
import softDeletePlugin from "./plugins/softDelete.js";
import CustomError from "../utils/CustomError.js";

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Department name is required"],
      trim: true,
      maxlength: [100, "Department name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: [true, "Organization is required"],
      index: true,
    },
    hod: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
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
departmentSchema.plugin(mongoosePaginate);
departmentSchema.plugin(softDeletePlugin, {
  cascadeDelete: [
    { model: "User", field: "department", propagateDeletedBy: true },
    { model: "BaseTask", field: "department", propagateDeletedBy: true },
  ],
});

// Compound index for unique department name within organization
departmentSchema.index({ name: 1, organization: 1 }, { unique: true });

// Additional indexes for better query performance
departmentSchema.index({ organization: 1, createdAt: -1 });
departmentSchema.index({ organization: 1, isDeleted: 1 });

// Virtual for users in this department
departmentSchema.virtual("users", {
  ref: "User",
  localField: "_id",
  foreignField: "department",
});

// Virtual for users count
departmentSchema.virtual("usersCount", {
  ref: "User",
  localField: "_id",
  foreignField: "department",
  count: true,
});

// Virtual for tasks in this department
departmentSchema.virtual("tasks", {
  ref: "BaseTask",
  localField: "_id",
  foreignField: "department",
});

// Note: Department name uniqueness is enforced by compound unique index

// Pre-remove middleware to check for users
departmentSchema.pre("remove", async function (next) {
  try {
    const userCount = await mongoose
      .model("User")
      .countDocuments({
        department: this._id,
      })
      .session(this.$session());

    if (userCount > 0) {
      return next(
        new CustomError(
          "Cannot delete department with existing users",
          409,
          "DEPARTMENT_HAS_USERS"
        )
      );
    }
    next();
  } catch (error) {
    next(new CustomError(error.message, 400));
  }
});

// Static method to find departments by organization
departmentSchema.statics.findByOrganization = function (
  organizationId,
  conditions = {},
  session = null
) {
  return this.find({
    ...conditions,
    organization: organizationId,
  }).session(session);
};

// Static method to check if department name exists in organization
departmentSchema.statics.nameExistsInOrganization = async function (
  name,
  organizationId,
  excludeId = null,
  session = null
) {
  const query = {
    name: name,
    organization: organizationId,
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const existing = await this.findOne(query).session(session);
  return !!existing;
};

// Instance method to check if department has users
departmentSchema.methods.hasUsers = async function (session = null) {
  const userCount = await mongoose
    .model("User")
    .countDocuments({
      department: this._id,
    })
    .session(session);
  return userCount > 0;
};

// Instance method to get HOD (Head of Department)
departmentSchema.methods.getHOD = function (session = null) {
  return mongoose
    .model("User")
    .findOne({
      department: this._id,
      isHod: true,
    })
    .session(session);
};

const Department = mongoose.model("Department", departmentSchema);

// TTL index will be managed by the centralized TTL configuration system

export default Department;

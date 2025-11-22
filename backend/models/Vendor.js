import mongoose from "mongoose";
import validator from "validator";
import mongoosePaginate from "mongoose-paginate-v2";
import softDeletePlugin from "./plugins/softDelete.js";
import { TASK_STATUS, REGEX_PATTERNS } from "../constants/index.js";
import CustomError from "../utils/CustomError.js";

const vendorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Vendor name is required"],
      trim: true,
      maxlength: [100, "Vendor name cannot exceed 100 characters"],
    },
    contactPerson: {
      type: String,
      required: [true, "Contact person is required"],
      trim: true,
      maxlength: [100, "Contact person cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      validate: {
        validator: validator.isEmail,
        message: "Please provide a valid email address",
      },
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      match: [REGEX_PATTERNS.PHONE, "Please provide a valid phone number"],
    },
    address: {
      type: String,
      trim: true,
      maxlength: [200, "Address cannot exceed 200 characters"],
    },
    serviceCategories: [
      {
        type: String,
        required: [true, "At least one service category is required"],
        trim: true,
        maxlength: [50, "Service category cannot exceed 50 characters"],
      },
    ],
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: [true, "Organization is required"],
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Created by is required"],
    },
    // Rating and performance tracking
    rating: {
      type: Number,
      min: [1, "Rating must be between 1 and 5"],
      max: [5, "Rating must be between 1 and 5"],
      default: 3,
    },
    totalProjects: {
      type: Number,
      min: [0, "Total projects cannot be negative"],
      default: 0,
    },
    totalCost: {
      type: Number,
      min: [0, "Total cost cannot be negative"],
      default: 0,
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
vendorSchema.plugin(mongoosePaginate);
vendorSchema.plugin(softDeletePlugin);
// Compound indexes for unique vendor fields within organization
vendorSchema.index({ name: 1, organization: 1 }, { unique: true });
vendorSchema.index({ email: 1, organization: 1 }, { unique: true });
vendorSchema.index({ phone: 1, organization: 1 }, { unique: true });

// Additional indexes for better query performance
vendorSchema.index({ organization: 1, serviceCategories: 1 });
vendorSchema.index({ organization: 1, rating: -1 });
vendorSchema.index({ organization: 1, createdAt: -1 });

// Virtual for project tasks
vendorSchema.virtual("projectTasks", {
  ref: "BaseTask",
  localField: "_id",
  foreignField: "vendor",
  match: { taskType: "ProjectTask" },
});

// Virtual for average project cost
vendorSchema.virtual("averageProjectCost").get(function () {
  return this.totalProjects > 0 ? this.totalCost / this.totalProjects : 0;
});

// Note: Vendor name uniqueness is enforced by compound unique index

// Pre-save middleware to validate service categories
vendorSchema.pre("save", function (next) {
  try {
    if (this.serviceCategories && this.serviceCategories.length === 0) {
      return next(
        new CustomError(
          "At least one service category is required",
          400,
          "MISSING_SERVICE_CATEGORIES"
        )
      );
    }
    next();
  } catch (error) {
    next(new CustomError(error.message, 400));
  }
});

// Static method to find vendors by organization
vendorSchema.statics.findByOrganization = function (
  organizationId,
  conditions = {},
  session = null
) {
  return this.find({
    ...conditions,
    organization: organizationId,
  }).session(session);
};

// Static method to find vendors by service category
vendorSchema.statics.findByServiceCategory = function (
  organizationId,
  category,
  conditions = {},
  session = null
) {
  return this.find({
    ...conditions,
    organization: organizationId,
    serviceCategories: { $in: [category] },
  }).session(session);
};

// Static method to find top-rated vendors
vendorSchema.statics.findTopRated = function (
  organizationId,
  limit = 10,
  session = null
) {
  return this.find({
    organization: organizationId,
  })
    .sort({ rating: -1, totalProjects: -1 })
    .limit(limit)
    .session(session);
};

// Instance method to update project statistics
vendorSchema.methods.updateProjectStats = function (
  projectCost,
  session = null
) {
  this.totalProjects += 1;
  this.totalCost += projectCost;
  return this.save({ session });
};

// Instance method to update rating
vendorSchema.methods.updateRating = function (newRating, session = null) {
  if (newRating < 1 || newRating > 5) {
    throw new CustomError("Rating must be between 1 and 5", 400);
  }
  this.rating = newRating;
  return this.save({ session });
};

// Instance method to check if vendor has active projects
vendorSchema.methods.hasActiveProjects = async function (session = null) {
  const activeProjects = await mongoose
    .model("BaseTask")
    .countDocuments({
      vendor: this._id,
      taskType: "ProjectTask",
      status: {
        $in: [TASK_STATUS.TO_DO, TASK_STATUS.IN_PROGRESS, TASK_STATUS.ON_HOLD],
      },
    })
    .session(session);
  return activeProjects > 0;
};

const Vendor = mongoose.model("Vendor", vendorSchema);

export default Vendor;

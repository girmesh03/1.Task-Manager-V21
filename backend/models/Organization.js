import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";
import validator from "validator";
import softDeletePlugin from "./plugins/softDelete.js";
import {
  ORGANIZATION_SIZES_ARRAY,
  REGEX_PATTERNS,
} from "../constants/index.js";
import CustomError from "../utils/CustomError.js";

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Organization name is required"],
      trim: true,
      maxlength: [100, "Organization name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    email: {
      type: String,
      required: [true, "Organization email is required"],
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
      required: [true, "Address is required"],
      trim: true,
      maxlength: [200, "Address cannot exceed 200 characters"],
    },
    size: {
      type: String,
      enum: {
        values: ORGANIZATION_SIZES_ARRAY,
        message: `Size must be one of: ${ORGANIZATION_SIZES_ARRAY.join(", ")}`,
      },
      required: [true, "Organization size is required"],
    },
    industry: {
      type: String,
      required: [true, "Industry is required"],
      trim: true,
      maxlength: [100, "Industry cannot exceed 100 characters"],
    },
    logo: {
      url: {
        type: String,
        trim: true,
        match: [REGEX_PATTERNS.URL, "Logo URL must be a valid URL"],
      },
      publicId: {
        type: String,
        trim: true,
      },
    },
    isPlatformOrg: {
      type: Boolean,
      default: false,
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
organizationSchema.plugin(mongoosePaginate);
organizationSchema.plugin(softDeletePlugin, {
  cascadeDelete: [
    { model: "Department", field: "organization", deletedBy: true },
    { model: "User", field: "organization", deletedBy: true },
    { model: "BaseTask", field: "organization", deletedBy: true },
    { model: "Material", field: "organization", deletedBy: true },
    { model: "Vendor", field: "organization", deletedBy: true },
    { model: "Notification", field: "organization", deletedBy: true },
  ],
});

// Unique indexes for platform-wide uniqueness
organizationSchema.index({ name: 1 }, { unique: true });
organizationSchema.index({ email: 1 }, { unique: true });
organizationSchema.index({ phone: 1 }, { unique: true });

// Additional indexes for better query performance
organizationSchema.index({ industry: 1 });
organizationSchema.index({ size: 1 });
organizationSchema.index({ createdAt: -1 });
organizationSchema.index({ isPlatformOrg: 1 });

// Virtual for departments
organizationSchema.virtual("departments", {
  ref: "Department",
  localField: "_id",
  foreignField: "organization",
});

// Virtual for users count
organizationSchema.virtual("usersCount", {
  ref: "User",
  localField: "_id",
  foreignField: "organization",
  count: true,
});

// Pre-save middleware for validation
organizationSchema.pre("save", async function (next) {
  try {
    // Ensure email is lowercase
    if (this.email) {
      this.email = this.email.toLowerCase();
    }
    next();
  } catch (error) {
    next(new CustomError(error.message, 400));
  }
});

// Static method to find platform organization
organizationSchema.statics.findPlatformOrganization = function (
  session = null
) {
  return this.findOne({ isPlatformOrg: true }).session(session);
};

// Static method to find customer organizations (excluding platform)
organizationSchema.statics.findCustomerOrganizations = function (
  conditions = {},
  session = null
) {
  return this.find({
    ...conditions,
    isPlatformOrg: false,
  }).session(session);
};

// Instance method to check if this is the platform organization
organizationSchema.methods.isPlatformOrganization = function () {
  return this.isPlatformOrg === true;
};

const Organization = mongoose.model("Organization", organizationSchema);

export default Organization;

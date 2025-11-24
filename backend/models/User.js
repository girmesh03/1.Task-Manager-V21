import mongoose from "mongoose";
import bcrypt from "bcrypt";
import validator from "validator";
import mongoosePaginate from "mongoose-paginate-v2";
import softDeletePlugin from "./plugins/softDelete.js";
import {
  USER_ROLES_ARRAY,
  USER_STATUS_ARRAY,
  USER_ROLES,
  USER_STATUS,
  REGEX_PATTERNS,
} from "../constants/index.js";
import { nowUTC } from "../utils/timezoneUtils.js";
import CustomError from "../utils/CustomError.js";

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      maxlength: [50, "First name cannot exceed 50 characters"],
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      maxlength: [50, "Last name cannot exceed 50 characters"],
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
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters long"],
      select: false, // Don't include password in queries by default
    },
    role: {
      type: String,
      enum: {
        values: USER_ROLES_ARRAY,
        message: `Role must be one of: ${USER_ROLES_ARRAY.join(", ")}`,
      },
      required: [true, "Role is required"],
      default: USER_ROLES.USER,
    },
    position: {
      type: String,
      required: [true, "Position is required"],
      trim: true,
      maxlength: [100, "Position cannot exceed 100 characters"],
    },
    profilePicture: {
      url: {
        type: String,
        trim: true,
        match: [REGEX_PATTERNS.URL, "Profile picture URL must be a valid URL"],
      },
      publicId: {
        type: String,
        trim: true,
      },
    },
    status: {
      type: String,
      enum: {
        values: USER_STATUS_ARRAY,
        message: `Status must be one of: ${USER_STATUS_ARRAY.join(", ")}`,
      },
      default: USER_STATUS.OFFLINE,
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
    isPlatformUser: {
      type: Boolean,
      default: false,
    },
    isHod: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    refreshToken: {
      type: String,
      select: false,
    },
    refreshTokenExpiry: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.id;
        delete ret.password;
        delete ret.refreshToken;
        delete ret.refreshTokenExpiry;
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
userSchema.plugin(mongoosePaginate);
userSchema.plugin(softDeletePlugin);

// Compound indexes for better query performance and constraints
userSchema.index({ email: 1, organization: 1 }, { unique: true });
userSchema.index({ organization: 1, department: 1 });
userSchema.index({ organization: 1, role: 1 });
userSchema.index({ department: 1, role: 1 });
userSchema.index({ organization: 1, isDeleted: 1 });

// Compound index for HOD uniqueness within department (only one HOD per department)
userSchema.index(
  { department: 1, isHod: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isHod: true,
      isDeleted: { $ne: true },
    },
  }
);

// Additional indexes for new fields
userSchema.index({ isPlatformUser: 1 });
userSchema.index({ isHod: 1 });

// Virtual for full name
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for assigned tasks
userSchema.virtual("assignedTasks", {
  ref: "BaseTask",
  localField: "_id",
  foreignField: "assignees",
});

// Virtual for created tasks
userSchema.virtual("createdTasks", {
  ref: "BaseTask",
  localField: "_id",
  foreignField: "createdBy",
});

// Pre-save middleware for password hashing and HOD/platform user detection
userSchema.pre("save", async function (next) {
  try {
    // Only hash password if it's modified or new
    if (this.isModified("password")) {
      const saltRounds = 12;
      this.password = await bcrypt.hash(this.password, saltRounds);
    }

    // Set isHod based on role
    if (this.isModified("role")) {
      this.isHod = this.role === "SuperAdmin" || this.role === "Admin";
    }

    // Set isPlatformUser based on organization
    if (this.isModified("organization") && this.organization) {
      const Organization = mongoose.model("Organization");
      const org = await Organization.findById(this.organization).session(
        this.$session()
      );
      if (org) {
        this.isPlatformUser = org.isPlatformOrg === true;
      }
    }

    next();
  } catch (error) {
    next(new CustomError(error.message, 400));
  }
});

// Note: HOD position uniqueness is enforced by compound unique index

// Note: Email uniqueness within organization is enforced by compound unique index

// Instance method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error("Password comparison failed");
  }
};

// Instance method to check if user is HOD
userSchema.methods.isHOD = function () {
  return this.role === "SuperAdmin" || this.role === "Admin";
};

// Instance method to check if user is platform admin
userSchema.methods.isPlatformAdmin = function () {
  return this.isPlatformUser === true;
};

// Instance method to update last login
userSchema.methods.updateLastLogin = function () {
  this.lastLogin = nowUTC();
  return this.save();
};

// Instance method to update status
userSchema.methods.updateStatus = function (status) {
  this.status = status;
  return this.save();
};

// Static method to find users by organization
userSchema.statics.findByOrganization = function (
  organizationId,
  conditions = {}
) {
  return this.find({
    ...conditions,
    organization: organizationId,
  });
};

// Static method to find users by department
userSchema.statics.findByDepartment = function (departmentId, conditions = {}) {
  return this.find({
    ...conditions,
    department: departmentId,
  });
};

// Static method to find HODs in department
userSchema.statics.findHODsInDepartment = function (departmentId) {
  return this.find({
    department: departmentId,
    role: { $in: ["SuperAdmin", "Admin"] },
  });
};

// Static method to authenticate user
userSchema.statics.authenticate = async function (
  email,
  password,
  organizationId,
  session = null
) {
  try {
    const user = await this.findOne({
      email: email.toLowerCase(),
      organization: organizationId,
    })
      .select("+password")
      .populate("organization department")
      .session(session);

    if (!user) {
      return null;
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return null;
    }

    // Update last login
    await user.updateLastLogin();

    // Remove password from returned user object
    user.password = undefined;
    return user;
  } catch (error) {
    throw new CustomError("Authentication failed", 401);
  }
};

const User = mongoose.model("User", userSchema);

// TTL index will be managed by the centralized TTL configuration system

export default User;

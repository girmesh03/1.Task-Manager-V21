import mongoose from "mongoose";
import softDeletePlugin from "./plugins/softDelete.js";
import {
  REGEX_PATTERNS,
  ATTACHMENT_MODELS_ARRAY,
  ATTACHMENT_TYPES_ARRAY,
  ATTACHMENT_TYPES,
} from "../constants/index.js";
import CustomError from "../utils/CustomError.js";

const attachmentSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: [true, "Filename is required"],
      trim: true,
      maxlength: [255, "Filename cannot exceed 255 characters"],
    },
    originalName: {
      type: String,
      required: [true, "Original filename is required"],
      trim: true,
      maxlength: [255, "Original filename cannot exceed 255 characters"],
    },
    mimeType: {
      type: String,
      required: [true, "MIME type is required"],
      trim: true,
    },
    fileSize: {
      type: Number,
      required: [true, "File size is required"],
      min: [1, "File size must be greater than 0"],
    },
    // Cloudinary integration structure
    cloudinary: {
      url: {
        type: String,
        required: [true, "Attachment URL is required"],
        trim: true,
        match: [REGEX_PATTERNS.URL, "Attachment URL must be a valid URL"],
      },
      publicId: {
        type: String,
        required: [true, "Attachment public ID is required"],
        trim: true,
      },
    },
    // Polymorphic relationship - can be attached to different models
    attachedTo: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Attached to reference is required"],
      index: true,
    },
    attachedToModel: {
      type: String,
      required: [true, "Attached to model is required"],
      enum: {
        values: ATTACHMENT_MODELS_ARRAY,
        message: `Attached to model must be one of: ${ATTACHMENT_MODELS_ARRAY.join(
          ", "
        )}`,
      },
      index: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Uploaded by is required"],
      index: true,
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
    // File metadata
    fileCategory: {
      type: String,
      enum: {
        values: ATTACHMENT_TYPES_ARRAY,
        message: `File category must be one of: ${ATTACHMENT_TYPES_ARRAY.join(
          ", "
        )}`,
      },
      required: [true, "File category is required"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
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

// Apply soft delete plugin
attachmentSchema.plugin(softDeletePlugin);
// Indexes for better query performance
attachmentSchema.index({ attachedTo: 1, attachedToModel: 1 });
attachmentSchema.index({ organization: 1, department: 1 });
attachmentSchema.index({ organization: 1, fileCategory: 1 });
attachmentSchema.index({ uploadedBy: 1, createdAt: -1 });
attachmentSchema.index({ organization: 1, createdAt: -1 });
attachmentSchema.index({ publicId: 1 });

// Virtual for file size in human readable format
attachmentSchema.virtual("fileSizeFormatted").get(function () {
  const bytes = this.fileSize;
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
});

// Virtual for file extension
attachmentSchema.virtual("fileExtension").get(function () {
  return this.originalName.split(".").pop().toLowerCase();
});

// Pre-save middleware to determine file category based on MIME type and set organization/department
attachmentSchema.pre("save", async function (next) {
  try {
    // Set organization and department from parent entity if not already set
    if (!this.organization || !this.department) {
      let parentEntity = null;

      if (this.attachedToModel === "BaseTask") {
        parentEntity = await mongoose
          .model("BaseTask")
          .findById(this.attachedTo)
          .session(this.$session());
      } else if (this.attachedToModel === "TaskActivity") {
        const activity = await mongoose
          .model("TaskActivity")
          .findById(this.attachedTo)
          .session(this.$session());
        if (activity) {
          parentEntity = {
            organization: activity.organization,
            department: activity.department,
          };
        }
      } else if (this.attachedToModel === "TaskComment") {
        const comment = await mongoose
          .model("TaskComment")
          .findById(this.attachedTo)
          .session(this.$session());
        if (comment) {
          parentEntity = {
            organization: comment.organization,
            department: comment.department,
          };
        }
      }

      if (parentEntity) {
        if (!this.organization) {
          this.organization = parentEntity.organization;
        }
        if (!this.department) {
          this.department = parentEntity.department;
        }
      }
    }

    if (this.isNew || this.isModified("mimeType")) {
      const mimeType = this.mimeType.toLowerCase();

      if (mimeType.startsWith("image/")) {
        this.fileCategory = ATTACHMENT_TYPES.IMAGE;
      } else if (mimeType.startsWith("video/")) {
        this.fileCategory = ATTACHMENT_TYPES.VIDEO;
      } else if (mimeType.startsWith("audio/")) {
        this.fileCategory = ATTACHMENT_TYPES.AUDIO;
      } else if (
        mimeType.includes("pdf") ||
        mimeType.includes("document") ||
        mimeType.includes("text") ||
        mimeType.includes("spreadsheet") ||
        mimeType.includes("presentation")
      ) {
        this.fileCategory = ATTACHMENT_TYPES.DOCUMENT;
      } else {
        this.fileCategory = ATTACHMENT_TYPES.OTHER;
      }
    }
    next();
  } catch (error) {
    next(new CustomError(error.message, 400));
  }
});

// Static method to find attachments by parent entity
attachmentSchema.statics.findByParent = function (
  parentId,
  parentModel,
  conditions = {},
  session = null
) {
  return this.find({
    ...conditions,
    attachedTo: parentId,
    attachedToModel: parentModel,
  })
    .sort({ createdAt: -1 })
    .session(session);
};

// Static method to find attachments by organization
attachmentSchema.statics.findByOrganization = function (
  organizationId,
  conditions = {},
  session = null
) {
  return this.find({
    ...conditions,
    organization: organizationId,
  }).session(session);
};

// Static method to find attachments by file category
attachmentSchema.statics.findByCategory = function (
  organizationId,
  category,
  conditions = {},
  session = null
) {
  return this.find({
    ...conditions,
    organization: organizationId,
    fileCategory: category,
  }).session(session);
};

// Static method to get storage statistics for organization
attachmentSchema.statics.getStorageStats = async function (organizationId) {
  const stats = await this.aggregate([
    {
      $match: {
        organization: mongoose.Types.ObjectId(organizationId),
      },
    },
    {
      $group: {
        _id: "$fileCategory",
        count: { $sum: 1 },
        totalSize: { $sum: "$fileSize" },
      },
    },
  ]);

  const totalStats = await this.aggregate([
    {
      $match: {
        organization: mongoose.Types.ObjectId(organizationId),
        isDeleted: { $ne: true },
      },
    },
    {
      $group: {
        _id: null,
        totalFiles: { $sum: 1 },
        totalSize: { $sum: "$fileSize" },
      },
    },
  ]);

  return {
    byCategory: stats,
    total: totalStats[0] || { totalFiles: 0, totalSize: 0 },
  };
};

// Instance method to check if file is an image
attachmentSchema.methods.isImage = function () {
  return this.fileCategory === ATTACHMENT_TYPES.IMAGE;
};

// Instance method to check if file is a document
attachmentSchema.methods.isDocument = function () {
  return this.fileCategory === ATTACHMENT_TYPES.DOCUMENT;
};

// Instance method to get secure URL (for future implementation with signed URLs)
attachmentSchema.methods.getSecureUrl = function () {
  // For now, return the URL directly
  // In production, this could generate signed URLs for additional security
  return this.cloudinary.url;
};

const Attachment = mongoose.model("Attachment", attachmentSchema);

// TTL index will be managed by the centralized TTL configuration system

export default Attachment;

import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";
import softDeletePlugin from "./plugins/softDelete.js";
import CustomError from "../utils/CustomError.js";

const materialSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Material name is required"],
      trim: true,
      maxlength: [100, "Material name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      maxlength: [50, "Category cannot exceed 50 characters"],
    },
    unit: {
      type: String,
      required: [true, "Unit is required"],
      enum: {
        values: [
          "piece",
          "kg",
          "liter",
          "meter",
          "box",
          "pack",
          "bottle",
          "bag",
          "roll",
          "sheet",
        ],
        message:
          "Unit must be one of: piece, kg, liter, meter, box, pack, bottle, bag, roll, sheet",
      },
    },
    unitPrice: {
      type: Number,
      min: [0, "Unit price cannot be negative"],
      default: 0,
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
    },
    // Task associations with quantity tracking
    tasks: [
      {
        task: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "BaseTask",
        },
        quantityUsed: {
          type: Number,
          min: [0, "Quantity used cannot be negative"],
          default: 0,
        },
        assignedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
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
materialSchema.plugin(mongoosePaginate);
materialSchema.plugin(softDeletePlugin);
// Compound index for unique material name within organization
materialSchema.index({ name: 1, organization: 1 }, { unique: true });

// Additional indexes for better query performance
materialSchema.index({ organization: 1, category: 1 });
materialSchema.index({ organization: 1, createdAt: -1 });
materialSchema.index({ "tasks.task": 1 });

// Virtual for total quantity used across all tasks
materialSchema.virtual("totalQuantityUsed").get(function () {
  return this.tasks.reduce(
    (total, taskMaterial) => total + taskMaterial.quantityUsed,
    0
  );
});

// Virtual for total cost based on quantity used
materialSchema.virtual("totalCost").get(function () {
  return this.totalQuantityUsed * this.unitPrice;
});

// Note: Material name uniqueness is enforced by compound unique index

// Static method to find materials by organization
materialSchema.statics.findByOrganization = function (
  organizationId,
  conditions = {},
  session = null
) {
  return this.find({
    ...conditions,
    organization: organizationId,
  }).session(session);
};

// Static method to find materials by category
materialSchema.statics.findByCategory = function (
  organizationId,
  category,
  conditions = {},
  session = null
) {
  return this.find({
    ...conditions,
    organization: organizationId,
    category: category,
  }).session(session);
};

// Instance method to add task association
materialSchema.methods.addTaskAssociation = function (
  taskId,
  quantity = 0,
  session = null
) {
  const existingAssociation = this.tasks.find(
    (t) => t.task.toString() === taskId.toString()
  );

  if (existingAssociation) {
    existingAssociation.quantityUsed += quantity;
  } else {
    this.tasks.push({
      task: taskId,
      quantityUsed: quantity,
    });
  }

  return this.save({ session });
};

// Instance method to remove task association
materialSchema.methods.removeTaskAssociation = function (
  taskId,
  session = null
) {
  this.tasks = this.tasks.filter(
    (t) => t.task.toString() !== taskId.toString()
  );
  return this.save({ session });
};

// Instance method to update task quantity
materialSchema.methods.updateTaskQuantity = function (
  taskId,
  newQuantity,
  session = null
) {
  const association = this.tasks.find(
    (t) => t.task.toString() === taskId.toString()
  );

  if (association) {
    association.quantityUsed = newQuantity;
    return this.save({ session });
  }

  throw new CustomError("Task association not found", 404);
};

const Material = mongoose.model("Material", materialSchema);

export default Material;

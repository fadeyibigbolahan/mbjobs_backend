const { Schema, model } = require("mongoose");

const CourseProgressSchema = new Schema(
  {
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    apprentice: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    progress: {
      type: Number, // percentage (0–100)
      default: 0,
    },
    completedModules: [
      {
        type: Schema.Types.ObjectId,
      },
    ],
    // Add these fields for admin assignment tracking
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    assignmentDate: {
      type: Date,
    },
    isAdminAssigned: {
      type: Boolean,
      default: false,
    },
    // Optional: Add notes about the assignment
    assignmentNotes: {
      type: String,
    },
  },
  { timestamps: true },
);

module.exports = model("CourseProgress", CourseProgressSchema);

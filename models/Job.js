const { Schema, model } = require("mongoose");

const JobSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    description: {
      type: String,
      required: true,
    },
    requirements: {
      type: [String],
      default: [],
    },
    location: {
      type: String,
      required: true,
    },
    jobType: {
      type: String,
      enum: ["full-time", "part-time", "internship", "contract"],
      default: "full-time",
    },
    stipend: {
      type: String, // You can keep this if you want to show 'Negotiable' or similar
      default: "Negotiable",
    },
    salaryMin: {
      type: Number,
      default: 0,
    },
    salaryMax: {
      type: Number,
      default: 0,
    },
    employer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    applications: [
      {
        type: Schema.Types.ObjectId,
        ref: "Application",
      },
    ],
    status: {
      type: String,
      enum: ["open", "closed", "expired"],
      default: "open",
    },
    hires: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User" },
        status: {
          type: String,
          enum: [
            "offered",
            "accepted",
            "onboarding",
            "active",
            "terminated",
            "completed",
          ],
        },
        hireDate: Date,
        startDate: Date,
        salary: Number,
        employmentType: String, // Could differ from jobType
        notes: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = model("Job", JobSchema);

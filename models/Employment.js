const { Schema, model } = require("mongoose");

const EmploymentSchema = new Schema(
  {
    job: {
      type: Schema.Types.ObjectId,
      ref: "Job",
    },
    employer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    employee: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: Date,
    status: {
      type: String,
      enum: ["active", "terminated", "completed"],
      default: "active",
    },
    salary: {
      type: Number,
      required: true,
    },
    terms: {
      type: String, // Or create a more detailed terms schema
    },
  },
  { timestamps: true }
);

module.exports = model("Employment", EmploymentSchema);

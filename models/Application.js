const { Schema, model } = require("mongoose");

const ApplicationSchema = new Schema(
  {
    apprentice: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    job: {
      type: Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    coverLetter: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: [
        "pending",
        "underReview",
        "interviewScheduled",
        "accepted",
        "rejected",
      ],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = model("Application", ApplicationSchema);

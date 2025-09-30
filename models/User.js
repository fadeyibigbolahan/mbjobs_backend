const { required } = require("@hapi/joi");
const { Schema, model } = require("mongoose");

const UserSchema = new Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
      index: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    profileImage: {
      type: String, // Store the file URL or path
      default: "",
    },
    role: {
      type: String,
      enum: ["apprentice", "employer", "admin"],
      required: true,
      default: "apprentice",
    },

    subscription: {
      planId: { type: Schema.Types.ObjectId, ref: "PricingPlan" },
      startDate: Date,
      endDate: Date,
      status: {
        type: String,
        enum: ["active", "expired", "pending"],
        default: "pending",
      },
    },

    // In your UserSchema
    stripeCustomerId: {
      type: String,
      default: null,
    },

    verificationCode: {
      type: String,
      default: null,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    verificationCodeExpires: {
      type: Date,
      default: null,
    },

    // employer's field
    companyName: {
      type: String,
      default: "",
    },
    companyLogo: {
      type: String, // URL or path to the logo image
      default: "",
    },
    bio: {
      type: String,
      default: "",
    },

    // for apprentices
    currentEmployment: {
      type: Schema.Types.ObjectId,
      ref: "Employment",
      default: null,
    },
    employmentHistory: [
      {
        type: Schema.Types.ObjectId,
        ref: "Employment",
      },
    ],
    postedJobs: [
      {
        type: Schema.Types.ObjectId,
        ref: "Job",
      },
    ],

    // for employers
    employees: [
      {
        employee: { type: Schema.Types.ObjectId, ref: "User" },
        hireDate: Date,
        status: {
          type: String,
          enum: ["active", "terminated", "completed"],
          default: "active",
        },
      },
    ],

    unreadMessages: {
      type: Number,
      default: 0,
    },
    blockedUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    apprenticeCategories: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    wioaQuestionnaire: {
      completed: {
        type: Boolean,
        default: false,
      },
      completionDate: Date,
      data: {
        type: Schema.Types.ObjectId,
        ref: "WIOAQuestionnaire",
      },
    },
    // Add approval status field
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    approvalDate: Date,
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    rejectionReason: String,
  },
  { timestamps: true }
);

module.exports = model("User", UserSchema);

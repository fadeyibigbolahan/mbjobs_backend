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
    zipCode: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    profileImage: {
      url: {
        type: String,
        default: "",
      },
      public_id: {
        type: String,
        default: "",
      },
    },
    role: {
      type: String,
      enum: ["apprentice", "employer", "admin"],
      required: true,
      default: "apprentice",
    },

    // Add these fields for region tracking
    regionEligibility: {
      isEligible: {
        type: Boolean,
        default: false,
      },
      county: String,
      fipsCode: String,
      lastChecked: {
        type: Date,
        default: Date.now,
      },
      eligibilityReason: String, // "in_region", "out_of_region", "validation_failed"
    },

    subscription: {
      planId: { type: Schema.Types.ObjectId, ref: "PricingPlan" },
      startDate: Date,
      endDate: Date,
      status: {
        type: String,
        enum: ["active", "expired", "pending", "canceled"],
        default: "pending",
      },
      // Add these optional fields for better tracking
      planTitle: String,
      periodLabel: String,
      totalPaid: Number,
      autoRenew: {
        type: Boolean,
        default: true, // Default to true for new subscriptions
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
      url: {
        type: String,
        default: "",
      },
      public_id: {
        type: String,
        default: "",
      },
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
  { timestamps: true },
);

// Add a method to delete images from Cloudinary when user is deleted
UserSchema.pre("remove", async function (next) {
  try {
    const {
      deleteFromCloudinary,
      extractPublicId,
    } = require("../utils/cloudinary");

    // Delete profile image if exists
    if (this.profileImage.public_id) {
      await deleteFromCloudinary(this.profileImage.public_id);
    }

    // Delete company logo if exists
    if (this.companyLogo.public_id) {
      await deleteFromCloudinary(this.companyLogo.public_id);
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Add a method to check if subscription is expired
UserSchema.methods.isSubscriptionExpired = function () {
  if (
    !this.subscription ||
    !this.subscription.endDate ||
    this.subscription.status !== "active"
  ) {
    return true;
  }

  const now = new Date();
  const endDate = new Date(this.subscription.endDate);
  return endDate < now;
};

// Pre-save middleware to automatically update subscription status
UserSchema.pre("save", function (next) {
  if (
    this.subscription &&
    this.subscription.endDate &&
    this.subscription.status === "active"
  ) {
    const now = new Date();
    const endDate = new Date(this.subscription.endDate);

    if (endDate < now) {
      this.subscription.status = "expired";
      this.subscription.autoRenew = false;
    }
  }
  next();
});

module.exports = model("User", UserSchema);

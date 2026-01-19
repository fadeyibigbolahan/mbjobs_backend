// models/OrientationForm.js
const mongoose = require("mongoose");

const orientationFormSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    middleName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    suffix: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    phoneNumber: {
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
    address: {
      type: String,
      required: true,
      trim: true,
    },
    zipCode: {
      type: String,
      required: true,
      trim: true,
    },
    sex: {
      type: String,
      required: true,
      enum: ["Male", "Female", "Other"],
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    socialSecurityNumber: {
      type: String,
      required: true,
      unique: true,
    },
    employmentStatus: {
      type: String,
      required: true,
      enum: ["Employed", "Unemployed", "Self-Employed", "Student", "Retired"],
    },
    apprenticeProgramComplete: {
      type: Boolean,
      required: true,
      default: false,
    },
    // ADD THIS: Categories field to store selected categories
    selectedCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Index for better query performance
orientationFormSchema.index({ email: 1 });
orientationFormSchema.index({ socialSecurityNumber: 1 });

module.exports = mongoose.model("Orientation", orientationFormSchema);

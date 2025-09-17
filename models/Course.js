const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctAnswer: { type: String, required: true },
});

const ModuleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    text: { type: String },
    media: { type: String },
    duration: { type: String },
    quiz: [QuestionSchema],
  },
  { _id: true }
);

const CourseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  category: { type: String },
  difficulty: { type: String, enum: ["Beginner", "Intermediate", "Advanced"] },
  duration: { type: String },
  price: { type: Number, default: 0 },
  instructor: { type: String },
  published: { type: Boolean, default: false },
  enrollments: { type: Number, default: 0 },
  rating: { type: Number, default: 0 },
  thumbnail: { type: String },
  createdAt: { type: Date, default: Date.now },
  modules: [ModuleSchema],

  requiresWIOA: { type: Boolean, default: true },
  requiresApproval: { type: Boolean, default: true },
  allowedRoles: [{ type: String, enum: ["apprentice", "employer", "admin"] }],
});

module.exports = mongoose.model("Course", CourseSchema);

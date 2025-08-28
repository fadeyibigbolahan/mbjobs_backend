const express = require("express");
const router = express.Router();
const {
  createCourse,
  updateCourse,
  getAllCourses,
  getCourseById,
  enrollInCourse,
  getMyCourses,
  updateCourseProgress,
} = require("../controllers/courseController");

const { userAuth, checkRole } = require("../utils/Auth");

// Admin creates course
router.post("/", userAuth, checkRole(["admin"]), createCourse);
router.put("/:id", userAuth, checkRole(["admin"]), updateCourse);

// View courses
router.get("/", getAllCourses);
router.get("/:id", getCourseById);

// Apprentice features
router.post("/:id/enroll", userAuth, checkRole(["apprentice"]), enrollInCourse);
router.get("/my/course", userAuth, checkRole(["apprentice"]), getMyCourses);
router.post(
  "/:id/progress",
  userAuth,
  checkRole(["apprentice"]),
  updateCourseProgress
);

module.exports = router;

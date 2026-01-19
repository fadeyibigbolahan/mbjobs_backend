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
  getAvailableCourses,
  assignCoursesToApprentices,
  getApprenticesWithCourses,
  removeCourseAssignment,
} = require("../controllers/courseController");

const { userAuth, checkRole } = require("../utils/Auth");
const checkCourseAccess = require("../middlewares/courseAccess");

// Admin creates course
router.post("/", userAuth, checkRole(["admin"]), createCourse);
router.put("/:id", userAuth, checkRole(["admin"]), updateCourse);

// Admin course assignment routes
router.post(
  "/assign",
  userAuth,
  checkRole(["admin"]),
  assignCoursesToApprentices,
);

router.get(
  "/apprentices/with-courses",
  userAuth,
  checkRole(["admin"]),
  getApprenticesWithCourses,
);

router.delete(
  "/assign/:assignmentId",
  userAuth,
  checkRole(["admin"]),
  removeCourseAssignment,
);

// View courses - available to all authenticated users but filtered based on role/approval
router.get("/", userAuth, checkCourseAccess, getAllCourses);
router.get("/available", userAuth, checkCourseAccess, getAvailableCourses); // New endpoint for available courses
router.get("/:id", userAuth, checkCourseAccess, getCourseById);

// Apprentice features - with approval check middleware
router.post(
  "/:id/enroll",
  userAuth,
  checkRole(["apprentice"]),
  checkCourseAccess,
  enrollInCourse,
);
router.get(
  "/my/courses",
  userAuth,
  checkRole(["apprentice"]),
  checkCourseAccess,
  getMyCourses,
);
router.post(
  "/:id/progress",
  userAuth,
  checkRole(["apprentice"]),
  checkCourseAccess,
  updateCourseProgress,
);

module.exports = router;

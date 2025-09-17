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
} = require("../controllers/courseController");

const { userAuth, checkRole } = require("../utils/Auth");
const checkCourseAccess = require("../middlewares/courseAccess");

// Admin creates course
router.post("/", userAuth, checkRole(["admin"]), createCourse);
router.put("/:id", userAuth, checkRole(["admin"]), updateCourse);

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
  enrollInCourse
);
router.get(
  "/my/course",
  userAuth,
  checkRole(["apprentice"]),
  checkCourseAccess,
  getMyCourses
);
router.post(
  "/:id/progress",
  userAuth,
  checkRole(["apprentice"]),
  checkCourseAccess,
  updateCourseProgress
);

module.exports = router;

// const express = require("express");
// const router = express.Router();
// const {
//   createCourse,
//   updateCourse,
//   getAllCourses,
//   getCourseById,
//   enrollInCourse,
//   getMyCourses,
//   updateCourseProgress,
// } = require("../controllers/courseController");

// const { userAuth, checkRole } = require("../utils/Auth");

// // Admin creates course
// router.post("/", userAuth, checkRole(["admin"]), createCourse);
// router.put("/:id", userAuth, checkRole(["admin"]), updateCourse);

// // View courses
// router.get("/", getAllCourses);
// router.get("/:id", getCourseById);

// // Apprentice features
// router.post("/:id/enroll", userAuth, checkRole(["apprentice"]), enrollInCourse);
// router.get("/my/course", userAuth, checkRole(["apprentice"]), getMyCourses);
// router.post(
//   "/:id/progress",
//   userAuth,
//   checkRole(["apprentice"]),
//   updateCourseProgress
// );

// module.exports = router;

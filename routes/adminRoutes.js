// routes/adminRoutes.js
const express = require("express");
const router = express.Router();
const { userAuth, checkRole } = require("../utils/Auth");

const {
  getAllUsers,
  deleteUser,
  getAllApplications,
  updateCourse,
  deleteCourse,
  getPendingApprentices,
  approveApprentice,
  rejectApprentice,
  getApprenticeStatus,
  getDashboardStats,
} = require("../controllers/adminController");

// Dashboard stats
router.get(
  "/dashboard/stats",
  userAuth,
  checkRole(["admin"]),
  getDashboardStats
);

// User management
router.get("/users", userAuth, checkRole(["admin"]), getAllUsers);
router.delete("/users/:id", userAuth, checkRole(["admin"]), deleteUser);

// Application management
router.get("/applications", userAuth, checkRole(["admin"]), getAllApplications);

// Course management
router.put("/courses/:id", userAuth, checkRole(["admin"]), updateCourse);
router.delete("/courses/:id", userAuth, checkRole(["admin"]), deleteCourse);

// Apprentice approval management
router.get(
  "/apprentices/pending",
  userAuth,
  checkRole(["admin"]),
  getPendingApprentices
);
router.patch(
  "/apprentices/approve/:id",
  userAuth,
  checkRole(["admin"]),
  approveApprentice
);
router.patch(
  "/apprentices/reject/:id",
  userAuth,
  checkRole(["admin"]),
  rejectApprentice
);
router.get(
  "/apprentices/status/:id",
  userAuth,
  checkRole(["admin"]),
  getApprenticeStatus
);

module.exports = router;

// // routes/adminRoutes.js
// const express = require("express");
// const router = express.Router();
// const { userAuth, checkRole } = require("../utils/Auth");

// const {
//   getAllUsers,
//   deleteUser,
//   getAllApplications,
//   updateCourse,
//   deleteCourse,
// } = require("../controllers/adminController");

// router.get("/admin/users", userAuth, checkRole(["admin"]), getAllUsers);
// router.delete("/admin/users/:id", userAuth, checkRole(["admin"]), deleteUser);

// router.get(
//   "/admin/applications",
//   userAuth,
//   checkRole(["admin"]),
//   getAllApplications
// );

// router.put("/admin/courses/:id", userAuth, checkRole(["admin"]), updateCourse);
// router.delete(
//   "/admin/courses/:id",
//   userAuth,
//   checkRole(["admin"]),
//   deleteCourse
// );

// module.exports = router;

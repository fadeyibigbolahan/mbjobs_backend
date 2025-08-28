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
} = require("../controllers/adminController");

router.get("/admin/users", userAuth, checkRole(["admin"]), getAllUsers);
router.delete("/admin/users/:id", userAuth, checkRole(["admin"]), deleteUser);

router.get(
  "/admin/applications",
  userAuth,
  checkRole(["admin"]),
  getAllApplications
);

router.put("/admin/courses/:id", userAuth, checkRole(["admin"]), updateCourse);
router.delete(
  "/admin/courses/:id",
  userAuth,
  checkRole(["admin"]),
  deleteCourse
);

module.exports = router;

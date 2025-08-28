// routes/categoryRoutes.js
const express = require("express");
const router = express.Router();
const {
  addCategory,
  getCategories,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");
const { userAuth, checkRole } = require("../utils/Auth");

// Admin only
router.post("/", userAuth, checkRole(["admin"]), addCategory);
router.get("/", userAuth, getCategories);
router.put("/:id", userAuth, checkRole(["admin"]), updateCategory);
router.delete("/:id", userAuth, checkRole(["admin"]), deleteCategory);

module.exports = router;

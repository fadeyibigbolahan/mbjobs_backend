const express = require("express");
const router = express.Router();
const {
  createOrientationForm,
  getAllOrientationForms,
  getOrientationFormById,
  getAvailableCategories,
  updateOrientationFormCategories,
} = require("../controllers/orientationFormController");

// @route   POST /api/orientation-forms
// @desc    Create a new orientation form
// @access  Public
router.post("/", createOrientationForm);

// @route   GET /api/orientation-forms
// @desc    Get all orientation forms
// @access  Public
router.get("/", getAllOrientationForms);

// @route   GET /api/orientation-forms/:id
// @desc    Get single orientation form by ID
// @access  Public
router.get("/:id", getOrientationFormById);

// @route   GET /api/orientation-forms/categories/available
// @desc    Get all active categories available for selection
// @access  Public
router.get("/categories/available", getAvailableCategories);

// @route   PUT /api/orientation-forms/:id/categories
// @desc    Update categories for a specific orientation form
// @access  Public
router.put("/:id/categories", updateOrientationFormCategories);

module.exports = router;

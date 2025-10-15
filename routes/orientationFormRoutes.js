const express = require("express");
const router = express.Router();
const {
  createOrientationForm,
  getAllOrientationForms,
  getOrientationFormById,
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

module.exports = router;

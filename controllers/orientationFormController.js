const OrientationForm = require("../models/OrientationForm");

// Create a new orientation form
exports.createOrientationForm = async (req, res) => {
  try {
    const orientationForm = new OrientationForm(req.body);
    await orientationForm.save();

    res.status(201).json({
      success: true,
      data: orientationForm,
      message: "Orientation form created successfully",
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email or Social Security Number already exists",
      });
    }

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all orientation forms
exports.getAllOrientationForms = async (req, res) => {
  try {
    const orientationForms = await OrientationForm.find().sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: orientationForms.length,
      data: orientationForms,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get single orientation form by ID
exports.getOrientationFormById = async (req, res) => {
  try {
    const orientationForm = await OrientationForm.findById(req.params.id);

    if (!orientationForm) {
      return res.status(404).json({
        success: false,
        message: "Orientation form not found",
      });
    }

    res.status(200).json({
      success: true,
      data: orientationForm,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

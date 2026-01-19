const OrientationForm = require("../models/OrientationForm");
const Category = require("../models/Category");

exports.createOrientationForm = async (req, res) => {
  try {
    // Validate categories if provided
    if (req.body.selectedCategories && req.body.selectedCategories.length > 0) {
      // Check if all category IDs exist
      const categories = await Category.find({
        _id: { $in: req.body.selectedCategories },
        isActive: true,
      });

      if (categories.length !== req.body.selectedCategories.length) {
        return res.status(400).json({
          success: false,
          message: "One or more categories are invalid or inactive",
        });
      }
    }

    const orientationForm = new OrientationForm(req.body);
    await orientationForm.save();

    // Populate categories in the response
    const populatedForm = await OrientationForm.findById(orientationForm._id)
      .populate("selectedCategories", "name description")
      .exec();

    res.status(201).json({
      success: true,
      data: populatedForm,
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
    const orientationForms = await OrientationForm.find()
      .populate("selectedCategories", "name description")
      .sort({
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
    const orientationForm = await OrientationForm.findById(
      req.params.id,
    ).populate("selectedCategories", "name description");

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

// NEW: Get available categories (for frontend dropdown/selection)
exports.getAvailableCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .select("name description")
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// NEW: Update orientation form categories
exports.updateOrientationFormCategories = async (req, res) => {
  try {
    const { selectedCategories } = req.body;

    // Validate categories if provided
    if (selectedCategories && selectedCategories.length > 0) {
      const categories = await Category.find({
        _id: { $in: selectedCategories },
        isActive: true,
      });

      if (categories.length !== selectedCategories.length) {
        return res.status(400).json({
          success: false,
          message: "One or more categories are invalid or inactive",
        });
      }
    }

    const orientationForm = await OrientationForm.findByIdAndUpdate(
      req.params.id,
      { selectedCategories },
      { new: true, runValidators: true },
    ).populate("selectedCategories", "name description");

    if (!orientationForm) {
      return res.status(404).json({
        success: false,
        message: "Orientation form not found",
      });
    }

    res.status(200).json({
      success: true,
      data: orientationForm,
      message: "Categories updated successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

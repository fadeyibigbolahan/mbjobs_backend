const User = require("../models/User");
const WIOAQuestionnaire = require("../models/WIOAQuestionnaire");
const cloudinary = require("cloudinary").v2;
const fs = require("fs").promises;
const path = require("path");

// helper: convert "" to null recursively
function cleanEmptyStrings(obj) {
  Object.keys(obj).forEach((key) => {
    if (obj[key] === "") {
      obj[key] = null;
    } else if (typeof obj[key] === "object" && obj[key] !== null) {
      cleanEmptyStrings(obj[key]);
    }
  });
  return obj;
}

// Configure Cloudinary (should be done once in your app)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper function to clean up files
async function cleanupFiles(filePaths) {
  const deletePromises = filePaths.map(async (filePath) => {
    try {
      await fs.unlink(filePath);
      console.log(`Deleted local file: ${filePath}`);
    } catch (error) {
      console.error(`Error deleting file ${filePath}:`, error);
    }
  });

  await Promise.all(deletePromises);
}

// Get WIOA questionnaire for a user
const getQuestionnaire = async (req, res) => {
  try {
    const userId = req.userId; // Assuming you have userId from authentication middleware

    const questionnaire = await WIOAQuestionnaire.findOne({ userId });

    if (!questionnaire) {
      return res.status(404).json({
        success: false,
        message: "WIOA questionnaire not found for this user",
      });
    }

    res.status(200).json({
      success: true,
      data: questionnaire,
    });
  } catch (error) {
    console.error("Error fetching WIOA questionnaire:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching questionnaire",
    });
  }
};

// Create or update WIOA questionnaire
const saveQuestionnaire = async (req, res) => {
  let filesToDelete = []; // Track files to clean up

  try {
    const userId = req.user._id;
    let questionnaireData = cleanEmptyStrings(req.body);

    // Check if user exists and is an apprentice
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role !== "apprentice") {
      return res.status(403).json({
        success: false,
        message: "Only apprentices can complete WIOA questionnaire",
      });
    }

    // Handle file uploads to Cloudinary
    if (req.files) {
      // Upload drivers license image if provided
      if (req.files.driversLicenseImage && req.files.driversLicenseImage[0]) {
        const driversLicenseFile = req.files.driversLicenseImage[0];
        const driversLicenseResult = await cloudinary.uploader.upload(
          driversLicenseFile.path,
          {
            folder: "wioa/drivers-licenses",
          }
        );
        questionnaireData.driversLicenseImage = driversLicenseResult.secure_url;
        filesToDelete.push(driversLicenseFile.path); // Mark for cleanup
      }

      // Upload social security image if provided
      if (req.files.socialSecurityImage && req.files.socialSecurityImage[0]) {
        const socialSecurityFile = req.files.socialSecurityImage[0];
        const socialSecurityResult = await cloudinary.uploader.upload(
          socialSecurityFile.path,
          {
            folder: "wioa/social-security",
          }
        );
        questionnaireData.socialSecurityImage = socialSecurityResult.secure_url;
        filesToDelete.push(socialSecurityFile.path); // Mark for cleanup
      }
    }

    // Check if questionnaire already exists
    let questionnaire = await WIOAQuestionnaire.findOne({ userId });

    if (questionnaire) {
      // Update existing questionnaire
      questionnaire = await WIOAQuestionnaire.findByIdAndUpdate(
        questionnaire._id,
        { ...questionnaireData, userId },
        { new: true, runValidators: true }
      );
    } else {
      // Create new questionnaire
      questionnaire = new WIOAQuestionnaire({
        userId,
        ...questionnaireData,
      });
      await questionnaire.save();
    }

    // Update user's WIOA status if all required fields are completed
    const requiredFields = [
      "socialSecurityNumber",
      "lastName",
      "firstName",
      "streetAddress",
      "city",
      "state",
      "zipCode",
    ];

    const isCompleted = requiredFields.every(
      (field) =>
        questionnaire[field] && questionnaire[field].toString().trim() !== ""
    );

    if (isCompleted) {
      await User.findByIdAndUpdate(userId, {
        "wioaQuestionnaire.completed": true,
        "wioaQuestionnaire.completionDate": new Date(),
        "wioaQuestionnaire.data": questionnaire._id,
      });
    }

    // Clean up local files after successful processing
    await cleanupFiles(filesToDelete);

    res.status(200).json({
      success: true,
      message: "WIOA questionnaire saved successfully",
      data: questionnaire,
      completed: isCompleted,
    });
  } catch (error) {
    console.error("Error saving WIOA questionnaire:", error);

    // Clean up files even if there's an error
    try {
      await cleanupFiles(filesToDelete);
    } catch (cleanupError) {
      console.error("Error cleaning up files:", cleanupError);
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: Object.values(error.errors).map((e) => e.message),
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while saving questionnaire",
    });
  }
};

// Mark questionnaire as completed
const completeQuestionnaire = async (req, res) => {
  try {
    const userId = req.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role !== "apprentice") {
      return res.status(403).json({
        success: false,
        message: "Only apprentices can complete WIOA questionnaire",
      });
    }

    const questionnaire = await WIOAQuestionnaire.findOne({ userId });
    if (!questionnaire) {
      return res.status(404).json({
        success: false,
        message: "Questionnaire not found. Please fill out the form first.",
      });
    }

    // Update user's WIOA status
    await User.findByIdAndUpdate(userId, {
      "wioaQuestionnaire.completed": true,
      "wioaQuestionnaire.completionDate": new Date(),
      "wioaQuestionnaire.data": questionnaire._id,
    });

    res.status(200).json({
      success: true,
      message: "WIOA questionnaire marked as completed",
    });
  } catch (error) {
    console.error("Error completing WIOA questionnaire:", error);
    res.status(500).json({
      success: false,
      message: "Server error while completing questionnaire",
    });
  }
};

// Check if user has completed WIOA questionnaire
const checkCompletionStatus = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).populate("wioaQuestionnaire.data");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      completed: user.wioaQuestionnaire.completed,
      completionDate: user.wioaQuestionnaire.completionDate,
      questionnaire: user.wioaQuestionnaire.data,
    });
  } catch (error) {
    console.error("Error checking WIOA completion status:", error);
    res.status(500).json({
      success: false,
      message: "Server error while checking completion status",
    });
  }
};

// Admin function to get all questionnaires
const getAllQuestionnaires = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    const questionnaires = await WIOAQuestionnaire.find().populate(
      "userId",
      "fullName email role approvalStatus"
    );

    res.status(200).json({
      success: true,
      count: questionnaires.length,
      data: questionnaires,
    });
  } catch (error) {
    console.error("Error fetching all questionnaires:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching questionnaires",
    });
  }
};

// Admin function to get questionnaire by user ID
const getQuestionnaireByUserId = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    const { id } = req.params;
    const questionnaire = await WIOAQuestionnaire.findOne({
      userId: id,
    }).populate("userId", "fullName email role");

    if (!questionnaire) {
      return res.status(404).json({
        success: false,
        message: "WIOA questionnaire not found for this user",
      });
    }

    res.status(200).json({
      success: true,
      data: questionnaire,
    });
  } catch (error) {
    console.error("Error fetching questionnaire by user ID:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching questionnaire",
    });
  }
};

module.exports = {
  getQuestionnaire,
  saveQuestionnaire,
  completeQuestionnaire,
  checkCompletionStatus,
  getAllQuestionnaires,
  getQuestionnaireByUserId,
};

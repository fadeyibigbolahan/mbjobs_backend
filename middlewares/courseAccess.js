// middleware/courseAccess.js
const User = require("../models/User");

const checkCourseAccess = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // For apprentices, check if they're approved
    if (user.role === "apprentice" && user.approvalStatus !== "approved") {
      return res.status(403).json({
        success: false,
        message:
          "Admin approval required to access courses. Please complete your WIOA questionnaire and wait for admin approval.",
      });
    }

    next();
  } catch (error) {
    console.error("Error checking course access:", error);
    res.status(500).json({
      success: false,
      message: "Server error while checking access",
    });
  }
};

module.exports = checkCourseAccess;

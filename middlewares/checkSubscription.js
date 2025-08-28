// middleware/checkSubscription.js
const User = require("../models/User");

const checkSubscription = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    // Check if subscription is active and not expired
    if (
      user.subscription.status === "active" &&
      new Date() < user.subscription.endDate
    ) {
      next();
    } else {
      // Update status if expired
      if (new Date() >= user.subscription.endDate) {
        await User.findByIdAndUpdate(req.user._id, {
          "subscription.status": "expired",
        });
      }

      return res.status(403).json({
        success: false,
        message: "Your subscription is not active or has expired",
      });
    }
  } catch (error) {
    console.error("Error checking subscription:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = checkSubscription;

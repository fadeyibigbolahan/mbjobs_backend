const User = require("../models/User");
const {
  deleteFromCloudinary,
  extractPublicId,
} = require("../utils/cloudinary");

// GET /user/me
exports.getMyProfile = async (req, res) => {
  console.log("get profile called");
  try {
    const user = await User.findById(req.user._id)
      .select("-password")
      .populate("apprenticeCategories", "name") // 👈 only bring back category name
      .populate({
        path: "subscription.planId",
        select:
          "title subtitle monthlyPrice maxApprentices description features popular icon color bgColor borderColor buttonText subscriptionPeriods",
      });

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update employer profile with Cloudinary
exports.updateEmployerProfile = async (req, res) => {
  try {
    console.log("Update employer profile called");
    const { companyName, bio, phone, email } = req.body;
    const updateData = { companyName, bio, phone, email };

    // Handle company logo upload if exists
    if (req.fileData?.companyLogo) {
      // Get current user data first
      const currentUser = await User.findById(req.user._id);

      // Check and migrate old string format to new object format
      if (
        currentUser.companyLogo &&
        typeof currentUser.companyLogo === "string"
      ) {
        currentUser.companyLogo = {
          url: currentUser.companyLogo || "",
          public_id: currentUser.companyLogo
            ? extractPublicId(currentUser.companyLogo) || ""
            : "",
        };
      }

      // Delete old logo if exists and has public_id
      if (
        currentUser.companyLogo?.public_id &&
        currentUser.companyLogo.public_id !== ""
      ) {
        try {
          await deleteFromCloudinary(currentUser.companyLogo.public_id);
        } catch (error) {
          console.error("Error deleting old company logo:", error);
        }
      }

      updateData.companyLogo = {
        url: req.fileData.companyLogo.url,
        public_id: req.fileData.companyLogo.public_id,
      };
    }

    const updatedUser = await User.findByIdAndUpdate(req.user._id, updateData, {
      new: true,
    }).select("-password");

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error updating profile",
      error: err.message,
    });
  }
};

// PATCH /user/me - Main profile update function
exports.updateMyProfile = async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      companyName,
      bio,
      password,
      city,
      country,
    } = req.body;

    console.log("Update profile called");
    console.log("Request body:", req.body);
    console.log("File data from middleware:", req.fileData);

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ✅ DEBUG: Check current user data structure
    console.log("Current user data BEFORE migration:");
    console.log("profileImage type:", typeof user.profileImage);
    console.log("profileImage value:", user.profileImage);
    console.log("companyLogo type:", typeof user.companyLogo);
    console.log("companyLogo value:", user.companyLogo);

    // ✅ FIXED: Ensure profileImage and companyLogo are proper objects
    // Handle both string and object formats safely
    const ensureImageObject = (fieldValue) => {
      if (!fieldValue || fieldValue === "") {
        return { url: "", public_id: "" };
      }

      if (typeof fieldValue === "string") {
        return {
          url: fieldValue,
          public_id: extractPublicId(fieldValue) || "",
        };
      }

      // Already an object, ensure it has the right structure
      if (typeof fieldValue === "object") {
        return {
          url: fieldValue.url || "",
          public_id: fieldValue.public_id || "",
        };
      }

      // Fallback
      return { url: "", public_id: "" };
    };

    // Apply the fix to both fields
    user.profileImage = ensureImageObject(user.profileImage);
    user.companyLogo = ensureImageObject(user.companyLogo);

    console.log("After ensuring object structure:");
    console.log("profileImage:", user.profileImage);
    console.log("companyLogo:", user.companyLogo);

    // ✅ Email uniqueness check
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: "Email already in use",
        });
      }
      user.email = email;
    }

    // ✅ Phone uniqueness check
    if (phone && phone !== user.phone) {
      const phoneExists = await User.findOne({ phone });
      if (phoneExists) {
        return res.status(400).json({
          success: false,
          message: "Phone number already in use",
        });
      }
      user.phone = phone;
    }

    // ✅ General updates
    if (fullName) user.fullName = fullName;
    if (city) user.city = city;
    if (country) user.country = country;

    // ✅ Password update
    if (password && password.trim() !== "") {
      const bcrypt = require("bcrypt");
      const saltRounds = 10;
      user.password = await bcrypt.hash(password, saltRounds);
    }

    // ✅ Apprentice-specific updates
    if (user.role === "apprentice" && req.body.apprenticeCategories) {
      try {
        console.log("Raw apprenticeCategories:", req.body.apprenticeCategories);

        let categories;
        if (typeof req.body.apprenticeCategories === "string") {
          categories = JSON.parse(req.body.apprenticeCategories);
        } else if (Array.isArray(req.body.apprenticeCategories)) {
          categories = req.body.apprenticeCategories;
        } else {
          categories = [];
        }

        console.log("Parsed categories:", categories);
        user.apprenticeCategories = categories;
      } catch (err) {
        console.error("Failed to parse apprenticeCategories:", err);
        return res.status(400).json({
          success: false,
          message: "Invalid apprentice categories format",
        });
      }
    }

    // ✅ Employer-specific updates
    if (user.role === "employer") {
      if (companyName) user.companyName = companyName;
      if (bio) user.bio = bio;
    }

    // ✅ Handle uploaded files from Cloudinary - PROFILE IMAGE
    if (req.fileData?.profileImage) {
      console.log(
        "Profile image uploaded to Cloudinary:",
        req.fileData.profileImage,
      );

      // Delete old profile image from Cloudinary if exists
      if (user.profileImage?.public_id && user.profileImage.public_id !== "") {
        try {
          await deleteFromCloudinary(user.profileImage.public_id);
        } catch (error) {
          console.error("Error deleting old profile image:", error);
          // Continue even if deletion fails
        }
      }

      // Update with new Cloudinary data
      user.profileImage = {
        url: req.fileData.profileImage.url,
        public_id: req.fileData.profileImage.public_id,
      };
    }

    // ✅ Handle uploaded files from Cloudinary - COMPANY LOGO
    if (req.fileData?.companyLogo) {
      console.log(
        "Company logo uploaded to Cloudinary:",
        req.fileData.companyLogo,
      );

      // Delete old company logo from Cloudinary if exists
      if (user.companyLogo?.public_id && user.companyLogo.public_id !== "") {
        try {
          await deleteFromCloudinary(user.companyLogo.public_id);
        } catch (error) {
          console.error("Error deleting old company logo:", error);
          // Continue even if deletion fails
        }
      }

      // Update with new Cloudinary data
      user.companyLogo = {
        url: req.fileData.companyLogo.url,
        public_id: req.fileData.companyLogo.public_id,
      };
    }

    // ✅ CRITICAL: Final check before saving - ensure both fields are objects
    if (!user.profileImage || typeof user.profileImage !== "object") {
      user.profileImage = { url: "", public_id: "" };
    }
    if (!user.companyLogo || typeof user.companyLogo !== "object") {
      user.companyLogo = { url: "", public_id: "" };
    }

    console.log("Saving user with data:", {
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      city: user.city,
      country: user.country,
      role: user.role,
      apprenticeCategories: user.apprenticeCategories,
      companyName: user.companyName,
      bio: user.bio,
      profileImage: user.profileImage,
      companyLogo: user.companyLogo,
    });

    await user.save();

    // Populate apprenticeCategories with names for the response
    if (user.role === "apprentice") {
      await user.populate("apprenticeCategories", "name");
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        city: user.city,
        country: user.country,
        role: user.role,
        companyName: user.companyName,
        bio: user.bio,
        apprenticeCategories: user.apprenticeCategories,
        profileImage: user.profileImage?.url || "",
        companyLogo: user.companyLogo?.url || "",
      },
    });
  } catch (err) {
    console.error("Update profile error:", err);
    console.error("Full error details:", {
      message: err.message,
      code: err.code,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: err.message || "Internal server error",
    });
  }
};

// GET /users - Get all users with optional filtering, pagination, and sorting
exports.getAllUsers = async (req, res) => {
  try {
    // Extract query parameters
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      role,
      approvalStatus,
      subscriptionStatus,
      search,
      regionEligibility,
    } = req.query;

    // Build filter object
    const filter = {};

    // Filter by role
    if (role && ["apprentice", "employer", "admin"].includes(role)) {
      filter.role = role;
    }

    // Filter by approval status
    if (
      approvalStatus &&
      ["pending", "approved", "rejected"].includes(approvalStatus)
    ) {
      filter.approvalStatus = approvalStatus;
    }

    // Filter by subscription status
    if (subscriptionStatus) {
      if (subscriptionStatus === "active") {
        filter["subscription.status"] = "active";
        filter["subscription.endDate"] = { $gte: new Date() };
      } else if (subscriptionStatus === "expired") {
        filter["subscription.status"] = "expired";
      } else {
        filter["subscription.status"] = subscriptionStatus;
      }
    }

    // Filter by region eligibility
    if (regionEligibility !== undefined) {
      filter["regionEligibility.isEligible"] = regionEligibility === "true";
    }

    // Search filter (across multiple fields)
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { companyName: { $regex: search, $options: "i" } },
        { city: { $regex: search, $options: "i" } },
        { country: { $regex: search, $options: "i" } },
      ];
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Execute query with population
    const users = await User.find(filter)
      .select("-password -verificationCode") // Exclude sensitive fields
      .populate("apprenticeCategories", "name")
      .populate("subscription.planId", "title price") // Populate plan details
      .populate("approvedBy", "fullName email") // Populate admin who approved
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(); // Use lean for better performance

    // Get total count for pagination
    const totalUsers = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalUsers / limitNum);

    // Format response data
    const formattedUsers = users.map((user) => ({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      country: user.country,
      city: user.city,
      zipCode: user.zipCode,
      profileImage: user.profileImage,
      role: user.role,
      companyName: user.companyName,
      companyLogo: user.companyLogo,
      bio: user.bio,
      regionEligibility: user.regionEligibility,
      subscription: user.subscription,
      approvalStatus: user.approvalStatus,
      approvalDate: user.approvalDate,
      approvedBy: user.approvedBy,
      rejectionReason: user.rejectionReason,
      verified: user.verified,
      apprenticeCategories: user.apprenticeCategories,
      wioaQuestionnaire: user.wioaQuestionnaire,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      // Add computed fields
      isSubscriptionActive:
        user.subscription?.status === "active" &&
        new Date(user.subscription.endDate) > new Date(),
      isProfileComplete: this.checkProfileCompleteness(user),
    }));

    res.json({
      success: true,
      data: formattedUsers,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalUsers,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
      filters: {
        role,
        approvalStatus,
        subscriptionStatus,
        search,
        regionEligibility,
      },
    });
  } catch (err) {
    console.error("Get all users error:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: err.message,
    });
  }
};

// Helper function to check profile completeness
exports.checkProfileCompleteness = (user) => {
  const requiredFields = {
    apprentice: ["fullName", "email", "phone", "country", "city"],
    employer: ["fullName", "email", "phone", "country", "city", "companyName"],
    admin: ["fullName", "email", "phone"],
  };

  const fieldsToCheck = requiredFields[user.role] || requiredFields.apprentice;

  return fieldsToCheck.every((field) => {
    const value = user[field];
    return value !== undefined && value !== null && value !== "";
  });
};

// GET /users/stats - Get user statistics
exports.getUserStats = async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $facet: {
          roleStats: [
            {
              $group: {
                _id: "$role",
                count: { $sum: 1 },
              },
            },
          ],
          approvalStats: [
            {
              $group: {
                _id: "$approvalStatus",
                count: { $sum: 1 },
              },
            },
          ],
          subscriptionStats: [
            {
              $group: {
                _id: "$subscription.status",
                count: { $sum: 1 },
              },
            },
          ],
          regionStats: [
            {
              $group: {
                _id: "$regionEligibility.isEligible",
                count: { $sum: 1 },
              },
            },
          ],
          verificationStats: [
            {
              $group: {
                _id: "$verified",
                count: { $sum: 1 },
              },
            },
          ],
          wioaStats: [
            {
              $group: {
                _id: "$wioaQuestionnaire.completed",
                count: { $sum: 1 },
              },
            },
          ],
          monthlyRegistrations: [
            {
              $group: {
                _id: {
                  year: { $year: "$createdAt" },
                  month: { $month: "$createdAt" },
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { "_id.year": -1, "_id.month": -1 } },
            { $limit: 12 },
          ],
        },
      },
    ]);

    res.json({
      success: true,
      data: stats[0],
    });
  } catch (err) {
    console.error("Get user stats error:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching user statistics",
      error: err.message,
    });
  }
};

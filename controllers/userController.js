const User = require("../models/User");

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

// controllers/employerController.js
exports.updateEmployerProfile = async (req, res) => {
  try {
    console.log("Update employer profile called");
    const { companyName, bio, phone, email } = req.body;
    const updateData = { companyName, bio, phone, email };

    if (req.file) {
      updateData.companyLogo = req.file.path; // assuming you're uploading a file
    }

    const updatedUser = await User.findByIdAndUpdate(req.user._id, updateData, {
      new: true,
    });

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

// PATCH /user/me
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

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

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

    // ✅ Handle uploaded files
    if (req.files?.profileImage) {
      console.log("Profile image uploaded:", req.files.profileImage[0]);
      user.profileImage = req.files.profileImage[0].path;
    }

    if (req.files?.companyLogo) {
      console.log("Company logo uploaded:", req.files.companyLogo[0]);
      user.companyLogo = req.files.companyLogo[0].path;
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
        profileImage: user.profileImage,
        companyLogo: user.companyLogo,
      },
    });
  } catch (err) {
    console.error("Update profile error:", err);
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

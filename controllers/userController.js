const User = require("../models/User");

// GET /user/me
exports.getMyProfile = async (req, res) => {
  console.log("get profile called");
  try {
    const user = await User.findById(req.user._id)
      .select("-password")
      .populate("apprenticeCategories", "name"); // 👈 only bring back category name

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// controllers/employerController.js
exports.updateEmployerProfile = async (req, res) => {
  try {
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
    const { fullName, email, phone, companyName, bio, password } = req.body;

    console.log("Update profile called");
    console.log("Request body:", req.body);
    console.log("Request files:", req.files);
    console.log("User ID:", req.user._id);

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

    // ✅ Password update
    if (password && password.trim() !== "") {
      // Assuming you have password hashing (bcrypt)
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
          // If it's a JSON string, parse it
          categories = JSON.parse(req.body.apprenticeCategories);
        } else if (Array.isArray(req.body.apprenticeCategories)) {
          // If it's already an array, use it directly
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

    // Return response with success field that frontend expects
    res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
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

exports.getUserCards = async (req, res) => {
  try {
    const userId = req.user._id; // Use req.user.id for the authenticated user

    const user = await User.findById(userId).populate(
      "organizations.organizationId"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get all the cards (memberships) the user has in different organizations
    const cards = user.organizations.map((orgMembership) => ({
      membershipId: orgMembership.membershipId,
      organizationName: orgMembership.organizationId.name, // Assuming organization has a name
      membershipLevel: orgMembership.membershipLevel,
      qrCodeUrl: orgMembership.qrCodeUrl, // QR code URL
    }));

    res.json({ cards });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMyOrgEvents = async (req, res) => {
  try {
    console.log("get my org events called");

    const userId = req.user._id;

    // Find all approved memberships for this user
    const memberships = await OrganizationMembership.find({
      userId,
      status: "approved",
    })
      .select("organizationId")
      .populate("organizationId", "name logoUrl");

    // Extract the raw ObjectIds
    const orgIds = memberships
      .map((m) => m.organizationId?._id)
      .filter(Boolean);

    if (orgIds.length === 0) {
      return res
        .status(200)
        .json({ message: "No organization memberships found", events: [] });
    }

    // Fetch events from those orgs
    const events = await Event.find({ organizationId: { $in: orgIds } })
      .populate("organizationId", "name logoUrl")
      .sort({ date: 1 });

    return res.status(200).json({
      message: "Events from your organizations retrieved successfully",
      events,
    });
  } catch (err) {
    console.error("getMyOrgEvents error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getMyBookedEvents = async (req, res) => {
  try {
    const userId = req.user._id;

    const bookings = await Booking.find({ userId })
      .populate("eventId")
      .populate("organizationId", "name logoUrl") // optional
      .sort({ bookedAt: -1 });

    return res.status(200).json({
      message: "Your booked events retrieved successfully",
      bookings,
    });
  } catch (err) {
    console.error("getMyBookedEvents error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

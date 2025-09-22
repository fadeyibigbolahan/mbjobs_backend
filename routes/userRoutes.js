const router = require("express").Router();
const User = require("../models/User");
const Job = require("../models/Job");
const Application = require("../models/Application");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
  getMyProfile,
  updateMyProfile,
  updateEmployerProfile,
} = require("../controllers/userController");
const {
  serializeUser,
  checkRole,
  userRegister,
  userLogin,
  userAuth,
} = require("../utils/Auth");

// Add formatDate function right after imports
const formatDate = (date) => {
  try {
    if (!date) return "Date not available";

    const now = new Date();
    const applicationDate = new Date(date);
    const diffTime = Math.abs(now - applicationDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30)
      return `${Math.floor(diffDays / 7)} week${
        Math.floor(diffDays / 7) === 1 ? "" : "s"
      } ago`;

    return applicationDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Invalid date";
  }
};

// Create uploads directory if it doesn't exist
const uploadDir = "uploads/";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
  },
});

// Users Registration Route
router.post("/register-apprentice", async (req, res) => {
  await userRegister(req.body, "apprentice", res);
});

router.post("/register-employer", async (req, res) => {
  await userRegister(req.body, "employer", res);
});

// Admins Registration Route
router.post("/register-admin", async (req, res) => {
  await userRegister(req.body, "admin", res);
});

// Users Login Route
router.post("/login-user", async (req, res) => {
  await userLogin(req.body, res);
});

// Get user profile
router.get("/me", userAuth, getMyProfile);

// Update user profile - THIS IS THE IMPORTANT FIX
router.patch(
  "/me",
  userAuth,
  upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "companyLogo", maxCount: 1 },
  ]),
  updateMyProfile
);

// Update employer profile
router.put(
  "/employer/profile",
  userAuth,
  checkRole(["employer"]),
  upload.single("companyLogo"), // optional logo upload
  updateEmployerProfile
);

// In your server routes (e.g., routes/apprentice.js)
router.get("/dashboard-stats", userAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get application counts by status
    const applicationStats = await Application.aggregate([
      { $match: { apprentice: mongoose.Types.ObjectId(userId) } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Convert to object for easier access
    const statsObj = {};
    applicationStats.forEach((stat) => {
      statsObj[stat._id] = stat.count;
    });

    // Calculate profile strength (example logic)
    const user = await User.findById(userId);
    let profileStrength = 0;
    if (user.fullName) profileStrength += 20;
    if (user.email) profileStrength += 20;
    if (user.phone) profileStrength += 20;
    if (user.bio) profileStrength += 20;
    if (user.apprenticeCategories && user.apprenticeCategories.length > 0)
      profileStrength += 20;

    // Get count of verified skills (placeholder - you might have a different way to track this)
    const skillsVerified = user.apprenticeCategories
      ? user.apprenticeCategories.length
      : 0;

    res.json({
      applications:
        statsObj.pending +
        statsObj.underReview +
        statsObj.interviewScheduled +
        statsObj.accepted +
        statsObj.rejected,
      interviews: statsObj.interviewScheduled || 0,
      profileStrength,
      skillsVerified,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// In your server routes
router.get("/job-matches", userAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).populate("apprenticeCategories");

    // Get user's categories
    const userCategories = user.apprenticeCategories.map((cat) => cat._id);

    // Find jobs that match user's categories
    const matchedJobs = await Job.find({
      category: { $in: userCategories },
      status: "open",
    })
      .populate("category")
      .populate("employer", "companyName companyLogo")
      .sort({ createdAt: -1 })
      .limit(5);

    // Calculate match percentage (simplified)
    const jobsWithMatch = matchedJobs.map((job) => {
      // Simple matching algorithm - you can make this more sophisticated
      const matchPercentage =
        job.category && userCategories.includes(job.category._id)
          ? 85 + Math.floor(Math.random() * 15)
          : 70 + Math.floor(Math.random() * 15);

      return {
        id: job._id,
        title: job.title,
        company: job.employer.companyName,
        location: job.location,
        match: matchPercentage,
        skills: job.requirements.slice(0, 3), // Show first 3 requirements as skills
        posted: formatDate(job.createdAt), // You'll need to implement formatDate
      };
    });

    res.json(jobsWithMatch);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// In your server routes
router.get("/recent-applications", userAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const applications = await Application.find({ apprentice: userId })
      .populate("job", "title employer")
      .populate({
        path: "job",
        populate: {
          path: "employer",
          select: "companyName",
        },
      })
      .sort({ createdAt: -1 })
      .limit(5);

    console.log("Applications:", applications);

    // Use safer approach with fallback values instead of returning null
    const formattedApplications = applications.map((app) => {
      try {
        // Provide fallback values instead of returning null
        const position = app.job?.title || "Unknown Position";
        const company = app.job?.employer?.companyName || "Unknown Company";

        // Format status with fallback
        let formattedStatus = "Unknown Status";
        if (app.status) {
          formattedStatus =
            app.status.charAt(0).toUpperCase() +
            app.status.slice(1).replace(/([A-Z])/g, " $1");
        }

        return {
          id: app._id,
          position,
          company,
          status: formattedStatus,
          date: formatDate(app.createdAt),
        };
      } catch (mapError) {
        console.error(`Error processing application ${app._id}:`, mapError);
        // Return a minimal application object instead of null
        return {
          id: app._id,
          position: "Error loading position",
          company: "Error loading company",
          status: "Error",
          date: "Unknown date",
        };
      }
    });

    console.log("Formatted applications:", formattedApplications);
    res.json(formattedApplications);
  } catch (error) {
    console.error("Error in recent-applications API:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Debug route to test multer (you can remove this later)
router.post(
  "/test-upload",
  upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "companyLogo", maxCount: 1 },
  ]),
  (req, res) => {
    console.log("Test route - Body:", req.body);
    console.log("Test route - Files:", req.files);
    res.json({
      success: true,
      body: req.body,
      files: req.files,
      message: "Test upload successful",
    });
  }
);

module.exports = router;

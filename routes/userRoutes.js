const router = require("express").Router();
const User = require("../models/User");
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

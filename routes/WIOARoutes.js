const express = require("express");
const router = express.Router();
const {
  getQuestionnaire,
  saveQuestionnaire,
  completeQuestionnaire,
  checkCompletionStatus,
  getAllQuestionnaires,
  getQuestionnaireByUserId,
} = require("../controllers/WIOAController");
const { userAuth, checkRole } = require("../utils/Auth");

const multer = require("multer");
const path = require("path");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Temporary storage for files
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

// File filter to only allow images
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
    fileSize: 5 * 1024 * 1024, // Limit file size to 5MB
  },
});

// Apprentice routes
router.get("/", userAuth, getQuestionnaire);
router.post(
  "/",
  userAuth,
  upload.fields([
    { name: "driversLicenseImage", maxCount: 1 },
    { name: "socialSecurityImage", maxCount: 1 },
  ]),
  saveQuestionnaire
);
router.patch("/complete", userAuth, completeQuestionnaire);
router.get("/status", userAuth, checkCompletionStatus);

// Admin routes
router.get("/all", userAuth, checkRole(["admin"]), getAllQuestionnaires);
router.get(
  "/user/:id",
  userAuth,
  checkRole(["admin"]),
  getQuestionnaireByUserId
);

module.exports = router;

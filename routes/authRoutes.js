const express = require("express");
const router = express.Router();

const {
  forgotPassword,
  resetPassword,
  changePassword,
  verifyEmailWithCode,
  resendVerificationCode,
} = require("../controllers/authController");

const { userAuth } = require("../utils/Auth"); // Make sure this middleware is in place

router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.patch("/change-password", userAuth, changePassword);
router.post("/verify-email", verifyEmailWithCode);
router.post("/resend-code", resendVerificationCode);

module.exports = router;

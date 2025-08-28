const express = require("express");
const router = express.Router();
const {
  applyToJob,
  getMyApplications,
  getApplicationsForEmployer,
  updateApplicationStatus,
} = require("../controllers/applicationController");
const { userAuth, checkRole } = require("../utils/Auth");

router.post("/jobs/:id/apply", userAuth, checkRole(["apprentice"]), applyToJob);
router.get("/my", userAuth, checkRole(["apprentice"]), getMyApplications);
router.get(
  "/employer",
  userAuth,
  checkRole(["employer"]),
  getApplicationsForEmployer
);
router.patch(
  "/:applicationId/status",
  userAuth,
  checkRole(["employer"]),
  updateApplicationStatus
);

module.exports = router;

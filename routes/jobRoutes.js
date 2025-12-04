const express = require("express");
const router = express.Router();
const {
  createJob,
  getJobById,
  updateJob,
  deleteJob,
  getMyJobs,
  getAllJobs,
  getJobApplicants,
  getAllJobsAdmin,
  getJobStatsAdmin,
  deleteJobAdmin,
  updateJobStatusAdmin,

  // Hire management functions
  createHire,
  updateHireStatus,
  getJobHires,
  getMyHires,
  getAllEmployerHires,
  updateApplicationStatus,
  getHireById,
  respondToHireOffer,

  getApprenticeHireById,
} = require("../controllers/jobController");

const { checkRole, userAuth } = require("../utils/Auth");
const checkSubscription = require("../middlewares/checkSubscription");
// const checkJobOwnership = require("../middlewares/checkJobOwnership");
// const checkHireOwnership = require("../middlewares/checkHireOwnership");

// ---------- ADMIN ROUTES ----------
router.get("/admin/jobs", userAuth, checkRole(["admin"]), getAllJobsAdmin);
router.get(
  "/admin/jobs/stats",
  userAuth,
  checkRole(["admin"]),
  getJobStatsAdmin
);
router.delete("/admin/:id", userAuth, checkRole(["admin"]), deleteJobAdmin);
router.put(
  "/admin/:id/status",
  userAuth,
  checkRole(["admin"]),
  updateJobStatusAdmin
);

// ---------- EMPLOYER-SPECIFIC ROUTES ----------
router.get("/employer/jobs", userAuth, checkRole(["employer"]), getMyJobs);
router.get(
  "/employer/hires",
  userAuth,
  checkRole(["employer"]),
  getAllEmployerHires
);
router.put(
  "/applications/:id/status",
  userAuth,
  checkRole(["employer"]),
  updateApplicationStatus
);

// ---------- APPRENTICE-SPECIFIC ROUTES ----------
router.get("/my-hires", userAuth, checkRole(["apprentice"]), getMyHires);
router.put(
  "/my-hires/:hireId/respond",
  userAuth,
  checkRole(["apprentice"]),
  respondToHireOffer
);

// ---------- SHARED PARAMETERIZED ROUTES ----------
router.get(
  "/:id/applicants",
  userAuth,
  checkRole(["employer"]),
  getJobApplicants
);
router.get("/:id/hires", userAuth, checkRole(["employer"]), getJobHires);
router.post(
  "/:jobId/hire/:userId",
  userAuth,
  checkRole(["employer"]),
  createHire
);
router.put(
  "/:jobId/hire/:hireId/status",
  userAuth,
  checkRole(["employer", "apprentice"]),
  updateHireStatus
);
router.get(
  "/hires/:hireId",
  userAuth,
  checkRole(["employer", "apprentice"]),
  getHireById
);

// ---------- GENERAL JOB ROUTES ----------
router.post(
  "/",
  userAuth,
  checkRole(["employer"]),
  checkSubscription,
  createJob
);
router.get("/", userAuth, checkRole(["apprentice"]), getAllJobs);
router.get(
  "/:id",
  userAuth,
  checkRole(["employer", "apprentice", "admin"]),
  getJobById
);
router.put("/:id", userAuth, checkRole(["employer"]), updateJob);
router.delete("/:id", userAuth, checkRole(["employer"]), deleteJob);

router.get(
  "/my-hires/:id",
  userAuth,
  checkRole(["apprentice"]),
  getApprenticeHireById
);

module.exports = router;

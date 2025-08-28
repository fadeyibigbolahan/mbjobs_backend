// routes/jobRoutes.js
const express = require("express");
const router = express.Router();
const {
  createJob,
  getJobById,
  updateJob,
  deleteJob,
  getMyJobs,
  getAllJobs,
} = require("../controllers/jobController");

const { checkRole, userAuth } = require("../utils/Auth");

router.post("/", userAuth, checkRole(["employer"]), createJob);

const checkSubscription = require("../middlewares/checkSubscription");

router.post(
  "/",
  userAuth,
  checkRole(["employer"]),
  checkSubscription,
  createJob
);

router.get("/", userAuth, getAllJobs);

router.get("/:id", userAuth, getJobById);

router.put("/:id", userAuth, checkRole(["employer"]), updateJob);

router.delete("/:id", userAuth, checkRole(["employer"]), deleteJob);

router.get("/employer/jobs", userAuth, checkRole(["employer"]), getMyJobs);

module.exports = router;

// middleware/checkJobOwnership.js
const checkJobOwnership = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job)
      return res.status(404).json({ success: false, message: "Job not found" });

    if (
      job.employer.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    req.job = job;
    next();
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

// middleware/checkHireOwnership.js
const checkHireOwnership = async (req, res, next) => {
  try {
    const job = await Job.findOne({ "hires._id": req.params.hireId });
    if (!job)
      return res
        .status(404)
        .json({ success: false, message: "Hire not found" });

    const hire = job.hires.id(req.params.hireId);
    const isEmployer = job.employer.toString() === req.user._id.toString();
    const isEmployee = hire.user.toString() === req.user._id.toString();

    if (!isEmployer && !isEmployee && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    req.job = job;
    req.hire = hire;
    next();
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

// Then use them in routes:
router.get(
  "/:id/hires",
  userAuth,
  checkRole(["employer"]),
  checkJobOwnership,
  getJobHires
);
router.put(
  "/:jobId/hire/:hireId/status",
  userAuth,
  checkRole(["employer", "apprentice"]),
  checkHireOwnership,
  updateHireStatus
);

const Application = require("../models/Application");
const Job = require("../models/Job");
const Employment = require("../models/Employment");

// POST /jobs/:id/apply
exports.applyToJob = async (req, res) => {
  const { id } = req.params;
  const apprenticeId = req.user._id;
  const { coverLetter } = req.body;

  try {
    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    // Prevent duplicate applications
    const alreadyApplied = await Application.findOne({
      job: id,
      apprentice: apprenticeId,
    });
    if (alreadyApplied) {
      return res.status(400).json({
        success: false,
        message: "You've already applied for this job",
      });
    }

    const application = new Application({
      apprentice: apprenticeId,
      job: id,
      coverLetter,
    });

    await application.save();

    // Add apprentice to the job's applicants array if not already present
    job.applicants.push(apprenticeId);
    await job.save();

    res.status(201).json({ success: true, message: "Application submitted" });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

// GET /applications/my
exports.getMyApplications = async (req, res) => {
  try {
    const applications = await Application.find({
      apprentice: req.user._id,
    }).populate({
      path: "job",
      populate: {
        path: "employer",
        select: "fullName email companyName", // optional: only include fields you need
      },
    });

    res.status(200).json({ success: true, applications });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

exports.getApplicationsForEmployer = async (req, res) => {
  try {
    const employerId = req.user._id; // Assumes authentication middleware sets req.user

    // Step 1: Get all jobs posted by the employer
    const jobs = await Job.find({ employer: employerId }).select("_id");

    if (jobs.length === 0) {
      return res.status(200).json({ success: true, applications: [] });
    }

    const jobIds = jobs.map((job) => job._id);

    // Step 2: Get all applications for those jobs
    const applications = await Application.find({ job: { $in: jobIds } })
      .populate("apprentice", "fullName email") // add more fields as needed
      .populate("job", "title location"); // add more fields as needed

    res.status(200).json({ success: true, applications });
  } catch (error) {
    console.error("Error fetching applications for employer:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updateApplicationStatus = async (req, res) => {
  const { applicationId } = req.params;
  const { status, salary, terms, endDate } = req.body; // allow employer to pass salary, terms, etc.

  const validStatuses = [
    "pending",
    "underReview",
    "interviewScheduled",
    "accepted",
    "rejected",
  ];

  if (!validStatuses.includes(status)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid status value" });
  }

  try {
    // Find application
    const application = await Application.findById(applicationId).populate(
      "job"
    );
    if (!application) {
      return res
        .status(404)
        .json({ success: false, message: "Application not found" });
    }

    // Ensure only job owner can update
    if (application.job.employer.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    console.log("Updating application status:", application);

    // Update status
    application.status = status;
    await application.save();

    let employment = null;

    // Only create Employment if application is accepted
    if (status === "accepted") {
      // Close the job once an apprentice is hired
      application.job.status = "closed";
      await application.job.save();

      employment = new Employment({
        job: application.job._id,
        employer: req.user._id,
        employee: application.apprentice,
        salary: salary || application.job.salaryMin || 0,
        terms: terms || "Standard apprenticeship terms",
        endDate: endDate || null,
      });

      await employment.save();
    }

    res.json({
      success: true,
      message: "Application status updated",
      application,
      employment, // only returned if created
    });
  } catch (err) {
    console.error("Error updating application status:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

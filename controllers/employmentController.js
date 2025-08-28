// employment.controller.js
const Employment = require("../models/Employment");
const Application = require("../models/Application");
const Job = require("../models/Job");

exports.hireApplicant = async (req, res) => {
  try {
    const { applicationId, salary, terms } = req.body;
    const employerId = req.user._id; // Assuming authenticated employer

    // Get the application
    const application = await Application.findById(applicationId)
      .populate("job")
      .populate("apprentice");

    // Validate
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    if (application.job.employer.toString() !== employerId.toString()) {
      return res
        .status(403)
        .json({ error: "Not authorized to hire for this job" });
    }

    if (application.status === "accepted") {
      return res.status(400).json({ error: "Applicant already hired" });
    }

    // Create employment record
    const employment = new Employment({
      job: application.job._id,
      employer: employerId,
      employee: application.applicant._id,
      salary,
      terms,
    });

    await employment.save();

    // Update application status
    application.status = "hired";
    await application.save();

    // Update job status if needed
    if (application.job.status === "open") {
      await Job.findByIdAndUpdate(application.job._id, { status: "closed" });
    }

    // Update user records
    await User.findByIdAndUpdate(application.applicant._id, {
      currentEmployment: employment._id,
      $push: { employmentHistory: employment._id },
    });

    res.status(201).json(employment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

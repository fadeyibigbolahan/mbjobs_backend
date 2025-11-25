// controllers/jobController.js
const Job = require("../models/Job");
const Application = require("../models/Application"); // import if not already
const User = require("../models/User");

const PricingPlan = require("../models/PricingPlan"); // Assuming you have this model

// Create a job
exports.createJob = async (req, res) => {
  console.log("create job", req.body);
  try {
    // ✅ Restrict job posting to employers with active AND non-expired subscription
    if (req.user.role !== "employer" || !req.user.subscription) {
      return res.status(403).json({
        success: false,
        message: "Only employers with an active subscription can post jobs",
      });
    }

    // ✅ Check both status AND endDate to ensure subscription is truly active
    const now = new Date();
    const subscriptionEndDate = new Date(req.user.subscription.endDate);

    if (
      req.user.subscription.status !== "active" ||
      subscriptionEndDate < now
    ) {
      return res.status(403).json({
        success: false,
        message: "Your subscription has expired. Please renew to post jobs.",
      });
    }

    // ✅ Find employer's plan from DB (using planId saved in subscription)
    const plan = await PricingPlan.findById(req.user.subscription.planId);
    if (!plan) {
      return res.status(400).json({
        success: false,
        message: "Invalid subscription plan",
      });
    }

    // ✅ Count active jobs by this employer
    const activeJobs = await Job.countDocuments({
      employer: req.user._id,
      deadline: { $gte: new Date() }, // jobs still valid
    });

    if (activeJobs >= plan.maxApprentices) {
      return res.status(403).json({
        success: false,
        message: `Your current plan (${plan.title}) allows only ${plan.maxApprentices} active job posting(s).`,
      });
    }

    const {
      title,
      description,
      category,
      requirements,
      location,
      jobType,
      stipend,
      salaryMin,
      salaryMax,
      deadline,
    } = req.body;

    // ✅ Basic validation
    if (!title || !description || !category || !deadline) {
      return res.status(400).json({
        success: false,
        message: "Title, description, category, and deadline are required",
      });
    }

    // ✅ Validate deadline
    if (new Date(deadline) < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Deadline must be in the future",
      });
    }

    // ✅ Create new job
    const newJob = new Job({
      title,
      description,
      category,
      requirements,
      location,
      jobType,
      stipend: stipend || null,
      salaryMin: salaryMin || 0,
      salaryMax: salaryMax || 0,
      deadline,
      employer: req.user._id, // from auth middleware
    });

    let savedJob = await newJob.save();

    // ✅ Populate employer info for response
    savedJob = await savedJob.populate("employer", "fullName email");

    return res.status(201).json({
      success: true,
      job: savedJob,
      message: `Job created successfully under ${plan.title} plan. (${
        activeJobs + 1
      }/${plan.maxApprentices} used)`,
    });
  } catch (err) {
    console.error("Error creating job:", err.message);

    return res.status(500).json({
      success: false,
      message: "Failed to create job",
      error: err.message,
    });
  }
};

// Get a single job by ID
exports.getJobById = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate(
      "employer",
      "fullName email"
    );
    if (!job)
      return res.status(404).json({ success: false, message: "Job not found" });
    res.json({ success: true, job });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update a job
exports.updateJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job)
      return res.status(404).json({ success: false, message: "Job not found" });
    if (job.employer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    Object.assign(job, req.body);
    const updatedJob = await job.save();
    res.json({ success: true, job: updatedJob });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete a job
exports.deleteJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job)
      return res.status(404).json({ success: false, message: "Job not found" });
    if (job.employer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }
    await job.remove();
    res.json({ success: true, message: "Job deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get all jobs by current employer
exports.getMyJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ employer: req.user._id })
      .sort({ createdAt: -1 })
      .lean(); // lean returns plain JS objects

    // For each job, count how many applications are linked to it
    const jobsWithApplicantCounts = await Promise.all(
      jobs.map(async (job) => {
        const count = await Application.countDocuments({ job: job._id });
        return {
          ...job,
          applicantCount: count,
        };
      })
    );

    res.json({ success: true, jobs: jobsWithApplicantCounts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// controllers/jobController.js
exports.getAllJobs = async (req, res) => {
  try {
    const apprenticeId = req.user._id;
    console.log("Fetching jobs for apprentice:", apprenticeId);

    // Get apprentice details (to check categories)
    const apprentice = await User.findById(apprenticeId).select(
      "apprenticeCategories"
    );

    if (!apprentice) {
      return res
        .status(404)
        .json({ success: false, message: "Apprentice not found" });
    }

    // 1. Find all job IDs the apprentice has applied for
    const applications = await Application.find({
      apprentice: apprenticeId,
    }).select("job");
    const appliedJobIds = applications.map((app) => app.job.toString());

    // 2. Query jobs NOT applied for, open, not expired, and matching apprentice categories
    const jobs = await Job.find({
      _id: { $nin: appliedJobIds },
      status: "open",
      deadline: { $gte: new Date() },
      category: { $in: apprentice.apprenticeCategories }, // ✅ category match
    })
      .populate("employer", "fullName email companyName companyLogo")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      jobs,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch jobs",
      error: err.message,
    });
  }
};

// Get applicants for a specific job
exports.getJobApplicants = async (req, res) => {
  try {
    const jobId = req.params.id;
    const employerId = req.user._id;

    // Check if job exists and belongs to the employer
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    // Verify that the current user owns this job
    if (job.employer.toString() !== employerId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access to job applicants",
      });
    }

    // Get all applications for this job with apprentice details
    const applications = await Application.find({ job: jobId })
      .populate({
        path: "apprentice",
        select:
          "fullName email phone city country profileImage apprenticeCategories currentEmployment employmentHistory bio approvalStatus",
        populate: [
          {
            path: "apprenticeCategories",
            select: "name",
          },
          {
            path: "currentEmployment",
            select: "job employer startDate endDate status",
            populate: {
              path: "job",
              select: "title category",
            },
          },
        ],
      })
      .sort({ appliedAt: -1 });

    // Format the response data
    const applicants = applications.map((app) => ({
      applicationId: app._id,
      appliedAt: app.createdAt,
      status: app.status,
      coverLetter: app.coverLetter,
      resume: app.resume,
      apprentice: {
        id: app.apprentice._id,
        fullName: app.apprentice.fullName,
        email: app.apprentice.email,
        phone: app.apprentice.phone,
        city: app.apprentice.city,
        country: app.apprentice.country,
        profileImage: app.apprentice.profileImage,
        bio: app.apprentice.bio,
        approvalStatus: app.apprentice.approvalStatus,
        categories:
          app.apprentice.apprenticeCategories?.map((cat) => cat.name) || [],
        currentEmployment: app.apprentice.currentEmployment
          ? {
              jobTitle: app.apprentice.currentEmployment.job?.title,
              employer: app.apprentice.currentEmployment.employer,
              startDate: app.apprentice.currentEmployment.startDate,
              status: app.apprentice.currentEmployment.status,
            }
          : null,
        employmentHistoryCount: app.apprentice.employmentHistory?.length || 0,
      },
    }));

    res.status(200).json({
      success: true,
      job: {
        id: job._id,
        title: job.title,
        category: job.category,
        location: job.location,
      },
      applicants: applicants,
      totalApplicants: applicants.length,
      stats: {
        total: applicants.length,
        pending: applicants.filter((app) => app.status === "pending").length,
        reviewed: applicants.filter((app) => app.status === "reviewed").length,
        shortlisted: applicants.filter((app) => app.status === "shortlisted")
          .length,
        rejected: applicants.filter((app) => app.status === "rejected").length,
      },
    });
  } catch (err) {
    console.error("Error fetching job applicants:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch job applicants",
      error: err.message,
    });
  }
};

// Add to your jobController.js

// Get all jobs for admin
exports.getAllJobsAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, jobType } = req.query;

    console.log("Admin fetching jobs with filters:", {
      search,
      status,
      jobType,
    });

    // Build filter object
    const filter = {};
    if (status && status !== "all") filter.status = status;
    if (jobType && jobType !== "all") filter.jobType = jobType;

    // Search filter
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const jobs = await Job.find(filter)
      .populate("employer", "fullName email companyName companyLogo")
      .populate("category", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const totalJobs = await Job.countDocuments(filter);
    const totalPages = Math.ceil(totalJobs / limitNum);

    console.log(`Found ${jobs.length} jobs out of ${totalJobs} total`);

    res.json({
      success: true,
      data: jobs,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalJobs,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    });
  } catch (err) {
    console.error("Error in getAllJobsAdmin:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching jobs",
      error: err.message,
    });
  }
};

// Get job stats for admin
exports.getJobStatsAdmin = async (req, res) => {
  try {
    console.log("Fetching job stats for admin");

    const stats = await Job.aggregate([
      {
        $facet: {
          statusStats: [
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 },
              },
            },
          ],
          typeStats: [
            {
              $group: {
                _id: "$jobType",
                count: { $sum: 1 },
              },
            },
          ],
          monthlyJobs: [
            {
              $group: {
                _id: {
                  year: { $year: "$createdAt" },
                  month: { $month: "$createdAt" },
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { "_id.year": -1, "_id.month": -1 } },
            { $limit: 12 },
          ],
        },
      },
    ]);

    res.json({
      success: true,
      data: stats[0],
    });
  } catch (err) {
    console.error("Error in getJobStatsAdmin:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching job statistics",
      error: err.message,
    });
  }
};

// Delete job as admin
exports.deleteJobAdmin = async (req, res) => {
  try {
    console.log("Admin deleting job:", req.params.id);

    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    await Job.findByIdAndDelete(req.params.id);

    // Also delete related applications
    await Application.deleteMany({ job: req.params.id });

    res.json({
      success: true,
      message: "Job deleted successfully",
    });
  } catch (err) {
    console.error("Error in deleteJobAdmin:", err);
    res.status(500).json({
      success: false,
      message: "Error deleting job",
      error: err.message,
    });
  }
};

// Update job status as admin
exports.updateJobStatusAdmin = async (req, res) => {
  try {
    const { status } = req.body;
    console.log("Admin updating job status:", req.params.id, "to", status);

    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    job.status = status;
    await job.save();

    res.json({
      success: true,
      message: "Job status updated successfully",
      job,
    });
  } catch (err) {
    console.error("Error in updateJobStatusAdmin:", err);
    res.status(500).json({
      success: false,
      message: "Error updating job status",
      error: err.message,
    });
  }
};

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

    // First, get the jobs with basic population
    const jobs = await Job.find(filter)
      .populate("employer", "fullName email companyName companyLogo")
      .populate("category", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Now populate the user field in each hire
    for (let job of jobs) {
      if (job.hires && job.hires.length > 0) {
        // Get user IDs from hires
        const userIds = job.hires.map((hire) => hire.user);

        // Fetch users
        const users = await User.find(
          { _id: { $in: userIds } },
          "fullName email phone profilePicture"
        ).lean();

        // Create a map of user data for quick lookup
        const userMap = {};
        users.forEach((user) => {
          userMap[user._id.toString()] = user;
        });

        // Attach user data to each hire
        job.hires = job.hires.map((hire) => ({
          ...hire,
          userData: userMap[hire.user.toString()] || null,
        }));
      }
    }

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

// Add to jobController.js - Offer job to applicant
exports.createHire = async (req, res) => {
  console.log(
    "Creating hire for job:",
    req.params.jobId,
    "to user:",
    req.params.userId
  );
  try {
    const { jobId, userId } = req.params;
    const { salary, employmentType, startDate, notes } = req.body;

    const job = await Job.findById(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    // Check if user owns the job
    if (job.employer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Check if applicant has applied
    const application = await Application.findOne({
      job: jobId,
      apprentice: userId,
      status: "accepted", // Only shortlisted candidates can be hired
    });

    console.log("Found application for hire:", application);

    if (!application) {
      return res.status(400).json({
        success: false,
        message: "Candidate must be accepted first",
      });
    }

    // Check if already hired
    const alreadyHired = job.hires.find(
      (hire) => hire.user.toString() === userId
    );

    if (alreadyHired) {
      return res.status(400).json({
        success: false,
        message: "Candidate already hired for this position",
      });
    }

    // Create hire entry
    job.hires.push({
      user: userId,
      status: "offered",
      hireDate: new Date(),
      startDate: startDate ? new Date(startDate) : null,
      salary: salary || job.salaryMax,
      employmentType: employmentType || job.jobType,
      notes: notes || "",
    });

    await job.save();

    // Update application status
    application.status = "hired";
    await application.save();

    // Populate user info for response
    const updatedJob = await Job.findById(jobId).populate(
      "hires.user",
      "fullName email phone"
    );

    res.status(201).json({
      success: true,
      message: "Job offer sent successfully",
      hire: updatedJob.hires[updatedJob.hires.length - 1],
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to create hire",
      error: err.message,
    });
  }
};

// Update hire status (accept/reject offer, start employment, etc.)
exports.updateHireStatus = async (req, res) => {
  try {
    const { jobId, hireId } = req.params;
    const { status, startDate, endDate } = req.body;

    const job = await Job.findById(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    // Find the hire
    const hireIndex = job.hires.findIndex(
      (hire) => hire._id.toString() === hireId
    );

    if (hireIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Hire not found",
      });
    }

    const hire = job.hires[hireIndex];

    // Authorization logic
    const isEmployer = job.employer.toString() === req.user._id.toString();
    const isEmployee = hire.user.toString() === req.user._id.toString();

    // Determine who can update what status
    if (status === "accepted" || status === "rejected") {
      // Only employee can accept/reject offers
      if (!isEmployee) {
        return res.status(403).json({
          success: false,
          message: "Only the candidate can accept/reject offers",
        });
      }
    } else if (
      ["onboarding", "active", "terminated", "completed"].includes(status)
    ) {
      // Only employer can update these statuses
      if (!isEmployer) {
        return res.status(403).json({
          success: false,
          message: "Only employer can update this status",
        });
      }
    }

    // Update hire
    job.hires[hireIndex].status = status;

    if (startDate) job.hires[hireIndex].startDate = new Date(startDate);
    if (endDate) job.hires[hireIndex].endDate = new Date(endDate);

    // If employee accepts, set start date if not already set
    if (status === "accepted" && !job.hires[hireIndex].startDate) {
      job.hires[hireIndex].startDate = new Date();
    }

    await job.save();

    res.json({
      success: true,
      message: `Hire status updated to ${status}`,
      hire: job.hires[hireIndex],
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to update hire status",
      error: err.message,
    });
  }
};

// Get all hires/offers for current apprentice
exports.getMyHires = async (req, res) => {
  try {
    const apprenticeId = req.user._id;

    // Find all jobs where the apprentice is in the hires array
    const jobsWithHires = await Job.find({
      "hires.user": apprenticeId,
    })
      .populate("employer", "fullName email companyName companyLogo")
      .populate("category", "name")
      .select("title category location jobType deadline hires")
      .lean();

    // Extract only the hire records for this apprentice
    const myHires = jobsWithHires.flatMap((job) => {
      return job.hires
        .filter((hire) => hire.user.toString() === apprenticeId.toString())
        .map((hire) => ({
          hireId: hire._id,
          status: hire.status,
          offerDate: hire.hireDate,
          startDate: hire.startDate,
          salary: hire.salary,
          employmentType: hire.employmentType,
          job: {
            id: job._id,
            title: job.title,
            category: job.category,
            location: job.location,
            jobType: job.jobType,
            deadline: job.deadline,
            employer: job.employer,
          },
        }));
    });

    // Sort by offer date (newest first)
    myHires.sort((a, b) => new Date(b.offerDate) - new Date(a.offerDate));

    res.status(200).json({
      success: true,
      hires: myHires,
      total: myHires.length,
      stats: {
        offered: myHires.filter((h) => h.status === "offered").length,
        accepted: myHires.filter((h) => h.status === "accepted").length,
        active: myHires.filter((h) => h.status === "active").length,
        completed: myHires.filter((h) => h.status === "completed").length,
      },
    });
  } catch (err) {
    console.error("Error fetching my hires:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch job offers",
      error: err.message,
    });
  }
};

// controllers/jobController.js

// Get all hires for a specific job (Employer only)
exports.getJobHires = async (req, res) => {
  try {
    const jobId = req.params.id;
    const employerId = req.user._id;

    // Find the job and populate hire details
    const job = await Job.findById(jobId)
      .populate({
        path: "hires.user",
        select:
          "fullName email phone profileImage city country bio apprenticeCategories",
        populate: {
          path: "apprenticeCategories",
          select: "name",
        },
      })
      .populate("category", "name")
      .populate("employer", "fullName email companyName companyLogo");

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    // Verify that the current user owns this job
    if (job.employer._id.toString() !== employerId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access to job hires",
      });
    }

    // Format hires data
    const hires = job.hires.map((hire) => ({
      hireId: hire._id,
      status: hire.status,
      offerDate: hire.offerDate,
      startDate: hire.startDate,
      endDate: hire.endDate,
      salary: hire.salary,
      employmentType: hire.employmentType,
      user: {
        id: hire.user._id,
        fullName: hire.user.fullName,
        email: hire.user.email,
        phone: hire.user.phone,
        city: hire.user.city,
        country: hire.user.country,
        profileImage: hire.user.profileImage,
        bio: hire.user.bio,
        categories:
          hire.user.apprenticeCategories?.map((cat) => cat.name) || [],
      },
      // Additional calculated fields
      duration: hire.startDate
        ? Math.floor(
            (new Date() - new Date(hire.startDate)) / (1000 * 60 * 60 * 24)
          ) + " days"
        : null,
      isActive: hire.status === "active",
      isCompleted: hire.status === "completed",
      isTerminated: hire.status === "terminated",
    }));

    // Sort hires by status and date
    const statusOrder = {
      active: 1,
      onboarding: 2,
      offered: 3,
      accepted: 4,
      completed: 5,
      terminated: 6,
      rejected: 7,
    };

    hires.sort((a, b) => {
      // First by status priority
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      // Then by offer date (newest first)
      return new Date(b.offerDate) - new Date(a.offerDate);
    });

    // Calculate statistics
    const stats = {
      total: hires.length,
      active: hires.filter((h) => h.status === "active").length,
      onboarding: hires.filter((h) => h.status === "onboarding").length,
      offered: hires.filter((h) => h.status === "offered").length,
      accepted: hires.filter((h) => h.status === "accepted").length,
      completed: hires.filter((h) => h.status === "completed").length,
      terminated: hires.filter((h) => h.status === "terminated").length,
      rejected: hires.filter((h) => h.status === "rejected").length,
    };

    res.status(200).json({
      success: true,
      job: {
        id: job._id,
        title: job.title,
        category: job.category?.name,
        location: job.location,
        jobType: job.jobType,
        status: job.status,
        deadline: job.deadline,
        employer: job.employer,
      },
      hires: hires,
      statistics: stats,
      pagination: {
        total: hires.length,
        page: 1,
        totalPages: 1,
      },
    });
  } catch (err) {
    console.error("Error fetching job hires:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch job hires",
      error: err.message,
    });
  }
};

exports.getAllEmployerHires = async (req, res) => {
  try {
    const employerId = req.user._id;

    const jobs = await Job.find({ employer: employerId })
      .populate({
        path: "hires.user",
        select: "fullName email phone profileImage",
      })
      .select("title hires");

    // Flatten hires from all jobs
    const allHires = jobs.flatMap((job) =>
      job.hires.map((hire) => ({
        ...hire.toObject(),
        jobTitle: job.title,
        jobId: job._id,
      }))
    );

    res.json({ success: true, hires: allHires });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update application status
exports.updateApplicationStatus = async (req, res) => {
  console.log("Updating application status:", req.params.id, req.body);
  try {
    const { id } = req.params;
    const { status } = req.body;

    const application = await Application.findById(id).populate(
      "job",
      "employer"
    );

    if (!application) {
      return res
        .status(404)
        .json({ success: false, message: "Application not found" });
    }

    // Check if user is the job owner
    if (application.job.employer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    application.status = status;
    await application.save();

    res.json({ success: true, application });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get specific hire by ID
exports.getHireById = async (req, res) => {
  try {
    const { hireId } = req.params;

    const job = await Job.findOne({ "hires._id": hireId })
      .populate({
        path: "hires.user",
        select: "fullName email phone profileImage",
      })
      .populate("employer", "fullName email companyName");

    if (!job) {
      return res
        .status(404)
        .json({ success: false, message: "Hire not found" });
    }

    const hire = job.hires.id(hireId);
    res.json({ success: true, hire, job: { title: job.title, id: job._id } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Apprentice responds to hire offer
exports.respondToHireOffer = async (req, res) => {
  try {
    const { hireId } = req.params;
    const { accept } = req.body; // boolean: true for accept, false for reject

    const job = await Job.findOne({ "hires._id": hireId });

    if (!job) {
      return res
        .status(404)
        .json({ success: false, message: "Hire not found" });
    }

    const hire = job.hires.id(hireId);

    // Check if apprentice owns this hire
    if (hire.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    if (hire.status !== "offered") {
      return res.status(400).json({
        success: false,
        message: "This offer has already been responded to",
      });
    }

    hire.status = accept ? "accepted" : "rejected";
    if (accept) {
      hire.startDate = hire.startDate || new Date();
    }

    await job.save();

    res.json({
      success: true,
      message: `Offer ${accept ? "accepted" : "rejected"} successfully`,
      hire,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get single hire details for apprentice (with job details)
exports.getApprenticeHireById = async (req, res) => {
  try {
    const { id } = req.params;
    const apprenticeId = req.user._id;

    // Find job where apprentice has this hire
    const job = await Job.findOne({
      "hires._id": id,
      "hires.user": apprenticeId,
    })
      .populate("employer", "fullName email companyName companyLogo phone")
      .populate("category", "name")
      .lean();

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Hire not found or unauthorized",
      });
    }

    // Find the specific hire
    const hire = job.hires.find(
      (h) =>
        h._id.toString() === id && h.user.toString() === apprenticeId.toString()
    );

    if (!hire) {
      return res.status(404).json({
        success: false,
        message: "Hire not found",
      });
    }

    // Format the response
    const response = {
      hireId: hire._id,
      status: hire.status,
      offerDate: hire.offerDate,
      startDate: hire.startDate,
      endDate: hire.endDate,
      salary: hire.salary,
      employmentType: hire.employmentType,
      notes: hire.notes || "",
      job: {
        id: job._id,
        title: job.title,
        description: job.description,
        location: job.location,
        jobType: job.jobType,
        requirements: job.requirements || [],
        deadline: job.deadline,
        category: job.category,
        employer: job.employer,
      },
    };

    res.status(200).json({
      success: true,
      hire: response,
    });
  } catch (err) {
    console.error("Error fetching apprentice hire details:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch hire details",
      error: err.message,
    });
  }
};

exports.getHireTimeline = async (req, res) => {
  try {
    const { id } = req.params;
    const apprenticeId = req.user._id;

    // Verify the hire belongs to the apprentice
    const job = await Job.findOne({
      "hires._id": id,
      "hires.user": apprenticeId,
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Hire not found or unauthorized",
      });
    }

    const hire = job.hires.find((h) => h._id.toString() === id);

    // Generate timeline based on hire status and dates
    const timeline = [];

    // Job Applied Date (from application)
    const application = await Application.findOne({
      job: job._id,
      apprentice: apprenticeId,
    });

    if (application) {
      timeline.push({
        id: 1,
        event: "Applied for Job",
        date: application.createdAt,
        status: "completed",
        icon: "📝",
        description: `Applied for ${job.title}`,
      });
    }

    // Offer Sent
    if (hire.offerDate) {
      timeline.push({
        id: 2,
        event: "Job Offer Sent",
        date: hire.offerDate,
        status: "completed",
        icon: "📧",
        description: "Received job offer from employer",
      });
    }

    // Offer Accepted/Rejected
    if (hire.status === "accepted" || hire.status === "rejected") {
      timeline.push({
        id: 3,
        event: `Offer ${hire.status === "accepted" ? "Accepted" : "Declined"}`,
        date: hire.startDate || new Date(),
        status: "completed",
        icon: hire.status === "accepted" ? "✅" : "❌",
        description: `You ${
          hire.status === "accepted" ? "accepted" : "declined"
        } the job offer`,
      });
    }

    // Onboarding
    if (hire.status === "onboarding") {
      timeline.push({
        id: 4,
        event: "Onboarding Started",
        date: new Date(),
        status: "in-progress",
        icon: "🚀",
        description: "Started onboarding process",
      });
    }

    // Active Employment
    if (hire.status === "active" && hire.startDate) {
      timeline.push({
        id: 5,
        event: "Employment Started",
        date: hire.startDate,
        status: "completed",
        icon: "💼",
        description: "Started working in the position",
      });
    }

    // Sort by date
    timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.status(200).json({
      success: true,
      timeline,
    });
  } catch (err) {
    console.error("Error fetching hire timeline:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch timeline",
      error: err.message,
    });
  }
};

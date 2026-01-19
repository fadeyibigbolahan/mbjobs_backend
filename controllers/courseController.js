const Course = require("../models/Course");
const CourseProgress = require("../models/CourseProgress");
const User = require("../models/User");

// Admin - Create Course
exports.createCourse = async (req, res) => {
  try {
    const courseData = {
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      difficulty: req.body.difficulty,
      duration: req.body.duration,
      price: req.body.price,
      instructor: req.body.instructor,
      published: req.body.published,
      enrollments: req.body.enrollments || 0,
      rating: req.body.rating || 0,
      thumbnail: req.body.thumbnail,
      modules: req.body.modules,
      createdBy: req.user._id,

      // Add enrollment requirements
      requiresWIOA:
        req.body.requiresWIOA !== undefined ? req.body.requiresWIOA : true,
      requiresApproval:
        req.body.requiresApproval !== undefined
          ? req.body.requiresApproval
          : true,
      allowedRoles: req.body.allowedRoles || [
        "apprentice",
        "employer",
        "admin",
      ],
      minProgress: req.body.minProgress || 0,
    };

    console.log("Creating course with data:", courseData);

    const course = new Course(courseData);
    await course.save();

    res.status(201).json({
      success: true,
      message: "Course created",
      course,
    });
  } catch (err) {
    console.error("Course creation error:", err);
    res.status(500).json({
      success: false,
      message: "Error creating course",
      error: err.message,
    });
  }
};

exports.updateCourse = async (req, res) => {
  try {
    const { id } = req.params;

    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const updates = {
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      difficulty: req.body.difficulty,
      duration: req.body.duration,
      price: req.body.price,
      instructor: req.body.instructor,
      published: req.body.published,
      enrollments: req.body.enrollments,
      rating: req.body.rating,
      thumbnail: req.body.thumbnail,
      modules: req.body.modules,

      // Update enrollment requirements
      requiresWIOA: req.body.requiresWIOA,
      requiresApproval: req.body.requiresApproval,
      allowedRoles: req.body.allowedRoles,
      minProgress: req.body.minProgress,
    };

    // Remove undefined values
    Object.keys(updates).forEach(
      (key) => updates[key] === undefined && delete updates[key],
    );

    const updatedCourse = await Course.findByIdAndUpdate(id, updates, {
      new: true,
    });

    res.status(200).json({
      success: true,
      message: "Course updated",
      course: updatedCourse,
    });
  } catch (err) {
    console.error("Course update error:", err);
    res.status(500).json({
      success: false,
      message: "Error updating course",
      error: err.message,
    });
  }
};

// Get all courses (with filters based on user role and approval status)
exports.getAllCourses = async (req, res) => {
  console.log("getting all courses");
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    let courses = await Course.find({ published: true }).sort({
      createdAt: -1,
    });

    // If user is not an admin, filter courses based on their approval status
    if (user.role !== "admin") {
      courses = courses.filter((course) => {
        // Check role restrictions
        if (course.allowedRoles && course.allowedRoles.length > 0) {
          if (!course.allowedRoles.includes(user.role)) {
            return false;
          }
        }

        // Check WIOA requirement for apprentices
        if (course.requiresWIOA && user.role === "apprentice") {
          if (!user.wioaQuestionnaire.completed) {
            return false;
          }
        }

        // Check approval requirement for apprentices
        if (course.requiresApproval && user.role === "apprentice") {
          if (user.approvalStatus !== "approved") {
            return false;
          }
        }

        return true;
      });
    }

    res.status(200).json({ success: true, courses });
  } catch (err) {
    console.error("Error fetching courses:", err);
    res.status(500).json({ success: false, message: "Error fetching courses" });
  }
};

// Get course by ID (with enrollment eligibility check)
exports.getCourseById = async (req, res) => {
  try {
    const userId = req.user._id;
    const courseId = req.params.id;

    const course = await Course.findById(courseId);
    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    const user = await User.findById(userId);
    let canEnroll = true;
    let enrollmentRequirements = [];

    // Check if user can enroll in this course
    if (user.role !== "admin") {
      // Check role restrictions
      if (course.allowedRoles && course.allowedRoles.length > 0) {
        if (!course.allowedRoles.includes(user.role)) {
          canEnroll = false;
          enrollmentRequirements.push(
            `Your role (${user.role}) is not allowed to enroll in this course`,
          );
        }
      }

      // Check WIOA requirement for apprentices
      if (course.requiresWIOA && user.role === "apprentice") {
        if (!user.wioaQuestionnaire.completed) {
          canEnroll = false;
          enrollmentRequirements.push("WIOA questionnaire must be completed");
        }
      }

      // Check approval requirement for apprentices
      if (course.requiresApproval && user.role === "apprentice") {
        if (user.approvalStatus !== "approved") {
          canEnroll = false;
          enrollmentRequirements.push("Admin approval is required");
        }
      }

      // Check if already enrolled
      const existingProgress = await CourseProgress.findOne({
        course: courseId,
        apprentice: userId,
      });

      if (existingProgress) {
        canEnroll = false;
        enrollmentRequirements.push("You are already enrolled in this course");
      }
    }

    res.status(200).json({
      success: true,
      course,
      canEnroll,
      enrollmentRequirements,
    });
  } catch (err) {
    console.error("Error fetching course:", err);
    res.status(500).json({ success: false, message: "Error fetching course" });
  }
};

// Enhanced enrollment with approval checks
exports.enrollInCourse = async (req, res) => {
  const { id } = req.params; // course ID
  const userId = req.user._id;

  try {
    // Check if already enrolled
    const existing = await CourseProgress.findOne({
      course: id,
      apprentice: userId,
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Already enrolled in this course",
      });
    }

    // Get user and course details for validation
    const user = await User.findById(userId);
    const course = await Course.findById(id);

    if (!user || !course) {
      return res.status(404).json({
        success: false,
        message: "User or course not found",
      });
    }

    // Check role restrictions
    if (course.allowedRoles && course.allowedRoles.length > 0) {
      if (!course.allowedRoles.includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: "Your role is not allowed to enroll in this course",
        });
      }
    }

    // Check WIOA requirement for apprentices
    if (course.requiresWIOA && user.role === "apprentice") {
      if (!user.wioaQuestionnaire.completed) {
        return res.status(403).json({
          success: false,
          message:
            "WIOA questionnaire must be completed before enrolling in this course",
        });
      }
    }

    // Check approval requirement for apprentices
    if (course.requiresApproval && user.role === "apprentice") {
      if (user.approvalStatus !== "approved") {
        return res.status(403).json({
          success: false,
          message: "Admin approval is required before enrolling in this course",
        });
      }
    }

    // Check prerequisite progress if needed
    if (course.minProgress > 0) {
      // Implement prerequisite check logic here
      // This would check if user has completed prerequisite courses with required progress
      const prerequisiteCourses = await Course.find({
        category: course.category,
        difficulty: { $lt: course.difficulty },
      });

      if (prerequisiteCourses.length > 0) {
        const prerequisiteIds = prerequisiteCourses.map((c) => c._id);
        const userProgress = await CourseProgress.find({
          apprentice: userId,
          course: { $in: prerequisiteIds },
        });

        const hasSufficientProgress = userProgress.every(
          (up) => up.progress >= course.minProgress,
        );

        if (!hasSufficientProgress) {
          return res.status(403).json({
            success: false,
            message: `You need at least ${course.minProgress}% progress in prerequisite courses to enroll`,
          });
        }
      }
    }

    // Save progress
    const progress = new CourseProgress({
      course: id,
      apprentice: userId,
    });
    await progress.save();

    // Increment enrollments count on Course
    await Course.findByIdAndUpdate(id, { $inc: { enrollments: 1 } });

    // Add to user's enrolled courses
    await User.findByIdAndUpdate(userId, {
      $push: {
        enrolledCourses: {
          course: id,
          enrollmentDate: new Date(),
        },
      },
    });

    res.status(201).json({
      success: true,
      message: "Enrolled successfully",
    });
  } catch (err) {
    console.error("Enrollment error:", err);
    res.status(500).json({
      success: false,
      message: "Error enrolling in course",
    });
  }
};

// Get user's courses with progress
exports.getMyCourses = async (req, res) => {
  const userId = req.user._id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // For apprentices, check if they're approved
    if (user.role === "apprentice" && user.approvalStatus !== "approved") {
      return res.status(403).json({
        success: false,
        message: "Admin approval required to access courses",
      });
    }

    const courses = await CourseProgress.find({ apprentice: userId })
      .populate("course")
      .sort({ updatedAt: -1 });

    res.status(200).json({ success: true, courses });
  } catch (err) {
    console.error("Error fetching user courses:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching your courses",
    });
  }
};

// Update course progress
exports.updateCourseProgress = async (req, res) => {
  const { id: courseId } = req.params;
  const { moduleId } = req.body;
  const userId = req.user._id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // For apprentices, check if they're approved
    if (user.role === "apprentice" && user.approvalStatus !== "approved") {
      return res.status(403).json({
        success: false,
        message: "Admin approval required to update course progress",
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const moduleExists = course.modules.some(
      (mod) => mod._id.toString() === moduleId,
    );
    if (!moduleExists) {
      return res.status(400).json({
        success: false,
        message: "Invalid module ID",
      });
    }

    let progressRecord = await CourseProgress.findOne({
      course: courseId,
      apprentice: userId,
    });

    if (!progressRecord) {
      // Check if user can enroll (meets requirements)
      if (
        course.requiresWIOA &&
        user.role === "apprentice" &&
        !user.wioaQuestionnaire.completed
      ) {
        return res.status(403).json({
          success: false,
          message:
            "WIOA questionnaire must be completed before accessing course content",
        });
      }

      if (
        course.requiresApproval &&
        user.role === "apprentice" &&
        user.approvalStatus !== "approved"
      ) {
        return res.status(403).json({
          success: false,
          message: "Admin approval is required before accessing course content",
        });
      }

      // Automatically enroll user if they meet requirements
      progressRecord = new CourseProgress({
        course: courseId,
        apprentice: userId,
        completedModules: [moduleId],
        progress: (1 / course.modules.length) * 100,
      });

      // Increment enrollments count on Course
      await Course.findByIdAndUpdate(courseId, { $inc: { enrollments: 1 } });

      // Add to user's enrolled courses
      await User.findByIdAndUpdate(userId, {
        $push: {
          enrolledCourses: {
            course: courseId,
            enrollmentDate: new Date(),
          },
        },
      });
    } else {
      if (!progressRecord.completedModules.includes(moduleId)) {
        progressRecord.completedModules.push(moduleId);
        const completedCount = progressRecord.completedModules.length;
        const totalCount = course.modules.length;
        progressRecord.progress = Math.round(
          (completedCount / totalCount) * 100,
        );
      }
    }

    await progressRecord.save();

    res.status(200).json({
      success: true,
      message: "Progress updated",
      progress: progressRecord.progress,
      completedModules: progressRecord.completedModules,
    });
  } catch (err) {
    console.error("Error updating progress:", err);
    res.status(500).json({
      success: false,
      message: "Error updating progress",
      error: err.message,
    });
  }
};

// Get courses available for a specific user (considering approval status)
exports.getAvailableCourses = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get all published courses
    let courses = await Course.find({ published: true });

    // Filter courses based on user's approval status and role
    const availableCourses = courses.filter((course) => {
      // Check role restrictions
      if (course.allowedRoles && course.allowedRoles.length > 0) {
        if (!course.allowedRoles.includes(user.role)) {
          return false;
        }
      }

      // Check WIOA requirement for apprentices
      if (course.requiresWIOA && user.role === "apprentice") {
        if (!user.wioaQuestionnaire.completed) {
          return false;
        }
      }

      // Check approval requirement for apprentices
      if (course.requiresApproval && user.role === "apprentice") {
        if (user.approvalStatus !== "approved") {
          return false;
        }
      }

      return true;
    });

    res.status(200).json({
      success: true,
      count: availableCourses.length,
      data: availableCourses,
    });
  } catch (error) {
    console.error("Error fetching available courses:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching available courses",
    });
  }
};

/**
 * Admin: Assign courses to one or multiple apprentices
 * Allows admins to bypass enrollment requirements and directly assign courses
 */
exports.assignCoursesToApprentices = async (req, res) => {
  try {
    const { apprenticeIds, courseIds, bypassRequirements = false } = req.body;
    const adminId = req.user._id;

    // Validate admin
    const admin = await User.findById(adminId);
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can assign courses",
      });
    }

    // Validate input
    if (
      !apprenticeIds ||
      !apprenticeIds.length ||
      !courseIds ||
      !courseIds.length
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide apprenticeIds and courseIds",
      });
    }

    // Convert to arrays if single values
    const apprenticeIdArray = Array.isArray(apprenticeIds)
      ? apprenticeIds
      : [apprenticeIds];
    const courseIdArray = Array.isArray(courseIds) ? courseIds : [courseIds];

    // Validate all apprentices exist and are apprentices
    const apprentices = await User.find({
      _id: { $in: apprenticeIdArray },
      role: "apprentice",
    });

    if (apprentices.length !== apprenticeIdArray.length) {
      return res.status(400).json({
        success: false,
        message: "Some apprentices not found or are not apprentices",
      });
    }

    // Validate all courses exist
    const courses = await Course.find({
      _id: { $in: courseIdArray },
    });

    if (courses.length !== courseIdArray.length) {
      return res.status(400).json({
        success: false,
        message: "Some courses not found",
      });
    }

    const results = {
      successfulAssignments: [],
      failedAssignments: [],
      skippedAssignments: [],
    };

    // Process each apprentice and course combination
    for (const apprentice of apprentices) {
      for (const course of courses) {
        try {
          // Check if already enrolled
          const existingProgress = await CourseProgress.findOne({
            course: course._id,
            apprentice: apprentice._id,
          });

          if (existingProgress) {
            results.skippedAssignments.push({
              apprenticeId: apprentice._id,
              apprenticeName: apprentice.fullName,
              courseId: course._id,
              courseTitle: course.title,
              reason: "Already enrolled",
            });
            continue;
          }

          // Check requirements unless bypassed
          if (!bypassRequirements) {
            // Check role restrictions
            if (course.allowedRoles && course.allowedRoles.length > 0) {
              if (!course.allowedRoles.includes(apprentice.role)) {
                results.failedAssignments.push({
                  apprenticeId: apprentice._id,
                  apprenticeName: apprentice.fullName,
                  courseId: course._id,
                  courseTitle: course.title,
                  reason: "Role not allowed for this course",
                });
                continue;
              }
            }

            // Check WIOA requirement
            if (
              course.requiresWIOA &&
              !apprentice.wioaQuestionnaire.completed
            ) {
              results.failedAssignments.push({
                apprenticeId: apprentice._id,
                apprenticeName: apprentice.fullName,
                courseId: course._id,
                courseTitle: course.title,
                reason: "WIOA questionnaire not completed",
              });
              continue;
            }

            // Check approval requirement
            if (
              course.requiresApproval &&
              apprentice.approvalStatus !== "approved"
            ) {
              results.failedAssignments.push({
                apprenticeId: apprentice._id,
                apprenticeName: apprentice.fullName,
                courseId: course._id,
                courseTitle: course.title,
                reason: "Apprentice not approved",
              });
              continue;
            }
          }

          // Create course progress record
          const progress = new CourseProgress({
            course: course._id,
            apprentice: apprentice._id,
            assignedBy: adminId,
            assignmentDate: new Date(),
            isAdminAssigned: true,
          });
          await progress.save();

          // Update course enrollment count
          await Course.findByIdAndUpdate(course._id, {
            $inc: { enrollments: 1 },
          });

          results.successfulAssignments.push({
            apprenticeId: apprentice._id,
            apprenticeName: apprentice.fullName,
            courseId: course._id,
            courseTitle: course.title,
          });
        } catch (error) {
          results.failedAssignments.push({
            apprenticeId: apprentice._id,
            apprenticeName: apprentice.fullName,
            courseId: course._id,
            courseTitle: course.title,
            reason: error.message,
          });
        }
      }
    }

    res.status(200).json({
      success: true,
      message: "Course assignment completed",
      results: {
        totalAssignmentsAttempted:
          apprenticeIdArray.length * courseIdArray.length,
        successful: results.successfulAssignments.length,
        failed: results.failedAssignments.length,
        skipped: results.skippedAssignments.length,
        details: {
          successfulAssignments: results.successfulAssignments,
          failedAssignments: results.failedAssignments,
          skippedAssignments: results.skippedAssignments,
        },
      },
    });
  } catch (error) {
    console.error("Error assigning courses:", error);
    res.status(500).json({
      success: false,
      message: "Error assigning courses",
      error: error.message,
    });
  }
};

/**
 * Get all apprentices with their assigned courses
 * Admin only - view all apprentices and their course progress
 */
exports.getApprenticesWithCourses = async (req, res) => {
  try {
    const adminId = req.user._id;

    // Validate admin
    const admin = await User.findById(adminId);
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can view all apprentices with courses",
      });
    }

    const { search, approvalStatus, hasWIOA, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    // Build filter for apprentices
    let filter = { role: "apprentice" };

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    if (approvalStatus) {
      filter.approvalStatus = approvalStatus;
    }

    if (hasWIOA === "true") {
      filter["wioaQuestionnaire.completed"] = true;
    } else if (hasWIOA === "false") {
      filter["wioaQuestionnaire.completed"] = false;
    }

    // Get apprentices with pagination
    const apprentices = await User.find(filter)
      .select(
        "fullName email phone approvalStatus wioaQuestionnaire subscription regionEligibility createdAt",
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get course progress for these apprentices
    const apprenticeIds = apprentices.map((apprentice) => apprentice._id);
    const courseProgress = await CourseProgress.find({
      apprentice: { $in: apprenticeIds },
    })
      .populate("course", "title category difficulty duration")
      .populate("assignedBy", "fullName email");

    // Group course progress by apprentice
    const progressByApprentice = {};
    courseProgress.forEach((progress) => {
      if (!progressByApprentice[progress.apprentice]) {
        progressByApprentice[progress.apprentice] = [];
      }
      progressByApprentice[progress.apprentice].push(progress);
    });

    // Combine apprentice data with their courses
    const apprenticesWithCourses = apprentices.map((apprentice) => ({
      ...apprentice.toObject(),
      courses: progressByApprentice[apprentice._id] || [],
      courseCount: (progressByApprentice[apprentice._id] || []).length,
    }));

    const total = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: apprenticesWithCourses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching apprentices with courses:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching apprentices with courses",
      error: error.message,
    });
  }
};

/**
 * Admin: Remove course assignment from apprentice
 */
exports.removeCourseAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const adminId = req.user._id;

    // Validate admin
    const admin = await User.findById(adminId);
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can remove course assignments",
      });
    }

    // Find and remove the course progress record
    const progress = await CourseProgress.findById(assignmentId);
    if (!progress) {
      return res.status(404).json({
        success: false,
        message: "Course assignment not found",
      });
    }

    // Decrease enrollment count on the course
    await Course.findByIdAndUpdate(progress.course, {
      $inc: { enrollments: -1 },
    });

    // Remove the progress record
    await progress.deleteOne();

    res.status(200).json({
      success: true,
      message: "Course assignment removed successfully",
      data: {
        apprenticeId: progress.apprentice,
        courseId: progress.course,
        removedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Error removing course assignment:", error);
    res.status(500).json({
      success: false,
      message: "Error removing course assignment",
      error: error.message,
    });
  }
};

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
      (key) => updates[key] === undefined && delete updates[key]
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
            `Your role (${user.role}) is not allowed to enroll in this course`
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
          (up) => up.progress >= course.minProgress
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
      (mod) => mod._id.toString() === moduleId
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
          (completedCount / totalCount) * 100
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

// const Course = require("../models/Course");
// const CourseProgress = require("../models/CourseProgress");

// // Admin - Create Course
// exports.createCourse = async (req, res) => {
//   try {
//     // Optional: destructure or validate req.body here
//     const courseData = {
//       title: req.body.title,
//       description: req.body.description,
//       category: req.body.category,
//       difficulty: req.body.difficulty,
//       duration: req.body.duration,
//       price: req.body.price,
//       instructor: req.body.instructor,
//       published: req.body.published,
//       enrollments: req.body.enrollments || 0,
//       rating: req.body.rating || 0,
//       thumbnail: req.body.thumbnail,
//       modules: req.body.modules,
//       createdBy: req.user._id, // ensure this is injected by auth middleware
//     };

//     console.log("Creating course with data:", courseData);

//     const course = new Course(courseData);
//     await course.save();

//     res.status(201).json({
//       success: true,
//       message: "Course created",
//       course,
//     });
//   } catch (err) {
//     console.error("Course creation error:", err);
//     res.status(500).json({
//       success: false,
//       message: "Error creating course",
//       error: err.message,
//     });
//   }
// };

// exports.updateCourse = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const course = await Course.findById(id);
//     if (!course) {
//       return res.status(404).json({
//         success: false,
//         message: "Course not found",
//       });
//     }

//     // Optional: Check if the user is the creator or has permission
//     // if (course.createdBy.toString() !== req.user._id.toString()) {
//     //   return res.status(403).json({ success: false, message: "Unauthorized" });
//     // }

//     const updates = {
//       title: req.body.title,
//       description: req.body.description,
//       category: req.body.category,
//       difficulty: req.body.difficulty,
//       duration: req.body.duration,
//       price: req.body.price,
//       instructor: req.body.instructor,
//       published: req.body.published,
//       enrollments: req.body.enrollments || 0,
//       rating: req.body.rating || 0,
//       thumbnail: req.body.thumbnail,
//       modules: req.body.modules,
//     };

//     const updatedCourse = await Course.findByIdAndUpdate(id, updates, {
//       new: true,
//     });

//     res.status(200).json({
//       success: true,
//       message: "Course updated",
//       course: updatedCourse,
//     });
//   } catch (err) {
//     console.error("Course update error:", err);
//     res.status(500).json({
//       success: false,
//       message: "Error updating course",
//       error: err.message,
//     });
//   }
// };

// // Get all courses
// exports.getAllCourses = async (req, res) => {
//   try {
//     const courses = await Course.find().sort({ createdAt: -1 });
//     res.status(200).json({ success: true, courses });
//   } catch (err) {
//     res.status(500).json({ success: false, message: "Error fetching courses" });
//   }
// };

// // Get course by ID
// exports.getCourseById = async (req, res) => {
//   try {
//     const course = await Course.findById(req.params.id);
//     if (!course) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Course not found" });
//     }
//     res.status(200).json({ success: true, course });
//   } catch (err) {
//     res.status(500).json({ success: false, message: "Error fetching course" });
//   }
// };

// exports.enrollInCourse = async (req, res) => {
//   const { id } = req.params; // course ID
//   const userId = req.user._id;

//   try {
//     // Check if already enrolled
//     const existing = await CourseProgress.findOne({
//       course: id,
//       apprentice: userId,
//     });
//     if (existing) {
//       return res.status(400).json({
//         success: false,
//         message: "Already enrolled in this course",
//       });
//     }

//     // Save progress
//     const progress = new CourseProgress({
//       course: id,
//       apprentice: userId,
//     });
//     await progress.save();

//     // Increment enrollments count on Course
//     await Course.findByIdAndUpdate(id, { $inc: { enrollments: 1 } });

//     res.status(201).json({
//       success: true,
//       message: "Enrolled successfully",
//     });
//   } catch (err) {
//     console.error("Enrollment error:", err);
//     res.status(500).json({
//       success: false,
//       message: "Error enrolling in course",
//     });
//   }
// };

// exports.getMyCourses = async (req, res) => {
//   const userId = req.user._id;
//   console.log("Fetching courses for user:", userId);
//   try {
//     const courses = await CourseProgress.find({ apprentice: userId }).populate(
//       "course"
//     );

//     res.status(200).json({ success: true, courses });
//   } catch (err) {
//     res
//       .status(500)
//       .json({ success: false, message: "Error fetching your courses" });
//   }
// };

// exports.updateCourseProgress = async (req, res) => {
//   const { id: courseId } = req.params; // course ID
//   const { moduleId } = req.body; // completed module ID
//   const userId = req.user._id;

//   try {
//     const course = await Course.findById(courseId);
//     if (!course) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Course not found" });
//     }

//     const moduleExists = course.modules.some(
//       (mod) => mod._id.toString() === moduleId
//     );
//     if (!moduleExists) {
//       return res
//         .status(400)
//         .json({ success: false, message: "Invalid module ID" });
//     }

//     let progressRecord = await CourseProgress.findOne({
//       course: courseId,
//       apprentice: userId,
//     });

//     if (!progressRecord) {
//       // Automatically enroll user if not found
//       progressRecord = new CourseProgress({
//         course: courseId,
//         apprentice: userId,
//         completedModules: [moduleId],
//         progress: (1 / course.modules.length) * 100,
//       });
//     } else {
//       if (!progressRecord.completedModules.includes(moduleId)) {
//         progressRecord.completedModules.push(moduleId);
//         const completedCount = progressRecord.completedModules.length;
//         const totalCount = course.modules.length;
//         progressRecord.progress = Math.round(
//           (completedCount / totalCount) * 100
//         );
//       }
//     }

//     await progressRecord.save();

//     res.status(200).json({
//       success: true,
//       message: "Progress updated",
//       progress: progressRecord.progress,
//       completedModules: progressRecord.completedModules,
//     });
//   } catch (err) {
//     console.error("Error updating progress:", err);
//     res.status(500).json({
//       success: false,
//       message: "Error updating progress",
//       error: err.message,
//     });
//   }
// };

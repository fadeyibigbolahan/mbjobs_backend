const Course = require("../models/Course");
const CourseProgress = require("../models/CourseProgress");

// Admin - Create Course
exports.createCourse = async (req, res) => {
  try {
    // Optional: destructure or validate req.body here
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
      createdBy: req.user._id, // ensure this is injected by auth middleware
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

    // Optional: Check if the user is the creator or has permission
    // if (course.createdBy.toString() !== req.user._id.toString()) {
    //   return res.status(403).json({ success: false, message: "Unauthorized" });
    // }

    const updates = {
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
    };

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

// Get all courses
exports.getAllCourses = async (req, res) => {
  try {
    const courses = await Course.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, courses });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching courses" });
  }
};

// Get course by ID
exports.getCourseById = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }
    res.status(200).json({ success: true, course });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching course" });
  }
};

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

    // Save progress
    const progress = new CourseProgress({
      course: id,
      apprentice: userId,
    });
    await progress.save();

    // Increment enrollments count on Course
    await Course.findByIdAndUpdate(id, { $inc: { enrollments: 1 } });

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

exports.getMyCourses = async (req, res) => {
  const userId = req.user._id;
  console.log("Fetching courses for user:", userId);
  try {
    const courses = await CourseProgress.find({ apprentice: userId }).populate(
      "course"
    );

    res.status(200).json({ success: true, courses });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Error fetching your courses" });
  }
};

exports.updateCourseProgress = async (req, res) => {
  const { id: courseId } = req.params; // course ID
  const { moduleId } = req.body; // completed module ID
  const userId = req.user._id;

  try {
    const course = await Course.findById(courseId);
    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    const moduleExists = course.modules.some(
      (mod) => mod._id.toString() === moduleId
    );
    if (!moduleExists) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid module ID" });
    }

    let progressRecord = await CourseProgress.findOne({
      course: courseId,
      apprentice: userId,
    });

    if (!progressRecord) {
      // Automatically enroll user if not found
      progressRecord = new CourseProgress({
        course: courseId,
        apprentice: userId,
        completedModules: [moduleId],
        progress: (1 / course.modules.length) * 100,
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

const User = require("../models/User");
const Application = require("../models/Application");
const Course = require("../models/Course");
const WIOAQuestionnaire = require("../models/WIOAQuestionnaire");

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const { role, approvalStatus, page = 1, limit = 10 } = req.query;

    // Build filter object
    const filter = {};
    if (role) filter.role = role;
    if (approvalStatus) filter.approvalStatus = approvalStatus;

    const skip = (page - 1) * limit;

    const users = await User.find(filter)
      .select("-password")
      .populate("wioaQuestionnaire.data")
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ success: false, message: "Error fetching users" });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    await User.findByIdAndDelete(id);
    res
      .status(200)
      .json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ success: false, message: "Error deleting user" });
  }
};

// Get all applications
exports.getAllApplications = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const filter = {};
    if (status) filter.status = status;

    const skip = (page - 1) * limit;

    const applications = await Application.find(filter)
      .populate("job")
      .populate("apprentice", "-password")
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Application.countDocuments(filter);

    res.status(200).json({
      success: true,
      applications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Error fetching applications:", err);
    res
      .status(500)
      .json({ success: false, message: "Error fetching applications" });
  }
};

// Update course
exports.updateCourse = async (req, res) => {
  try {
    const updated = await Course.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.status(200).json({ success: true, course: updated });
  } catch (err) {
    console.error("Error updating course:", err);
    res.status(500).json({ success: false, message: "Error updating course" });
  }
};

// Delete course
exports.deleteCourse = async (req, res) => {
  try {
    await Course.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Course deleted" });
  } catch (err) {
    console.error("Error deleting course:", err);
    res.status(500).json({ success: false, message: "Error deleting course" });
  }
};

// Get all apprentices pending approval
exports.getPendingApprentices = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const apprentices = await User.find({
      role: "apprentice",
      approvalStatus: "pending",
      "wioaQuestionnaire.completed": true,
    })
      .populate("wioaQuestionnaire.data")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments({
      role: "apprentice",
      approvalStatus: "pending",
      "wioaQuestionnaire.completed": true,
    });

    res.status(200).json({
      success: true,
      count: apprentices.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: apprentices,
    });
  } catch (error) {
    console.error("Error fetching pending apprentices:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching pending apprentices",
    });
  }
};

// Approve an apprentice
exports.approveApprentice = async (req, res) => {
  console.log("Approve apprentice called");
  try {
    const { id } = req.params;
    const { approvedBy } = req.body;

    const apprentice = await User.findById(id);

    if (!apprentice) {
      return res.status(404).json({
        success: false,
        message: "Apprentice not found",
      });
    }

    if (apprentice.role !== "apprentice") {
      return res.status(400).json({
        success: false,
        message: "User is not an apprentice",
      });
    }

    if (!apprentice.wioaQuestionnaire.completed) {
      return res.status(400).json({
        success: false,
        message: "Apprentice has not completed WIOA questionnaire",
      });
    }

    if (apprentice.approvalStatus === "approved") {
      return res.status(400).json({
        success: false,
        message: "Apprentice is already approved",
      });
    }

    apprentice.approvalStatus = "approved";
    apprentice.approvalDate = new Date();
    apprentice.approvedBy = approvedBy || req.user._id;

    await apprentice.save();

    // Send notification to apprentice (you would implement this)
    // sendApprovalNotification(apprentice);

    res.status(200).json({
      success: true,
      message: "Apprentice approved successfully",
      data: apprentice,
    });
  } catch (error) {
    console.error("Error approving apprentice:", error);
    res.status(500).json({
      success: false,
      message: "Server error while approving apprentice",
    });
  }
};

// Reject an apprentice
exports.rejectApprentice = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    const apprentice = await User.findById(id);

    if (!apprentice) {
      return res.status(404).json({
        success: false,
        message: "Apprentice not found",
      });
    }

    if (apprentice.role !== "apprentice") {
      return res.status(400).json({
        success: false,
        message: "User is not an apprentice",
      });
    }

    if (apprentice.approvalStatus === "rejected") {
      return res.status(400).json({
        success: false,
        message: "Apprentice is already rejected",
      });
    }

    apprentice.approvalStatus = "rejected";
    apprentice.approvalDate = new Date();
    apprentice.approvedBy = req.user._id;
    apprentice.rejectionReason = rejectionReason;

    await apprentice.save();

    // Send rejection notification to apprentice (you would implement this)
    // sendRejectionNotification(apprentice, rejectionReason);

    res.status(200).json({
      success: true,
      message: "Apprentice rejected successfully",
      data: apprentice,
    });
  } catch (error) {
    console.error("Error rejecting apprentice:", error);
    res.status(500).json({
      success: false,
      message: "Server error while rejecting apprentice",
    });
  }
};

// Get apprentice approval status (for admin view)
exports.getApprenticeStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id)
      .populate("wioaQuestionnaire.data")
      .select(
        "approvalStatus approvalDate approvedBy rejectionReason wioaQuestionnaire fullName email role",
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role !== "apprentice") {
      return res.status(400).json({
        success: false,
        message: "User is not an apprentice",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
        },
        approvalStatus: user.approvalStatus,
        approvalDate: user.approvalDate,
        approvedBy: user.approvedBy,
        rejectionReason: user.rejectionReason,
        wioaCompleted: user.wioaQuestionnaire.completed,
        wioaData: user.wioaQuestionnaire.data,
      },
    });
  } catch (error) {
    console.error("Error fetching apprentice status:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching apprentice status",
    });
  }
};

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalApprentices,
      pendingApprovals,
      totalCourses,
      publishedCourses,
      totalApplications,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "apprentice" }),
      User.countDocuments({
        role: "apprentice",
        approvalStatus: "pending",
        "wioaQuestionnaire.completed": true,
      }),
      Course.countDocuments(),
      Course.countDocuments({ published: true }),
      Application.countDocuments(),
    ]);

    res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          apprentices: totalApprentices,
          pendingApprovals: pendingApprovals,
        },
        courses: {
          total: totalCourses,
          published: publishedCourses,
        },
        applications: {
          total: totalApplications,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching dashboard statistics",
    });
  }
};

// const User = require("../models/User");
// const Application = require("../models/Application");
// const Course = require("../models/Course");
// const WIOAQuestionnaire = require("../models/WIOAQuestionnaire");

// exports.getAllUsers = async (req, res) => {
//   try {
//     const users = await User.find().select("-password"); // hide passwords
//     res.status(200).json({ success: true, users });
//   } catch (err) {
//     res.status(500).json({ success: false, message: "Error fetching users" });
//   }
// };

// exports.deleteUser = async (req, res) => {
//   const { id } = req.params;
//   try {
//     await User.findByIdAndDelete(id);
//     res
//       .status(200)
//       .json({ success: true, message: "User deleted successfully" });
//   } catch (err) {
//     res.status(500).json({ success: false, message: "Error deleting user" });
//   }
// };

// exports.getAllApplications = async (req, res) => {
//   try {
//     const applications = await Application.find()
//       .populate("job")
//       .populate("apprentice", "-password");
//     res.status(200).json({ success: true, applications });
//   } catch (err) {
//     res
//       .status(500)
//       .json({ success: false, message: "Error fetching applications" });
//   }
// };

// exports.updateCourse = async (req, res) => {
//   try {
//     const updated = await Course.findByIdAndUpdate(req.params.id, req.body, {
//       new: true,
//     });
//     res.status(200).json({ success: true, course: updated });
//   } catch (err) {
//     res.status(500).json({ success: false, message: "Error updating course" });
//   }
// };

// exports.deleteCourse = async (req, res) => {
//   try {
//     await Course.findByIdAndDelete(req.params.id);
//     res.status(200).json({ success: true, message: "Course deleted" });
//   } catch (err) {
//     res.status(500).json({ success: false, message: "Error deleting course" });
//   }
// };

// // Get all apprentices pending approval
// exports.getPendingApprentices = async (req, res) => {
//   try {
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 10;
//     const skip = (page - 1) * limit;

//     const apprentices = await User.find({
//       role: "apprentice",
//       approvalStatus: "pending",
//       "wioaQuestionnaire.completed": true,
//     })
//       .populate("wioaQuestionnaire.data")
//       .skip(skip)
//       .limit(limit)
//       .sort({ createdAt: -1 });

//     const total = await User.countDocuments({
//       role: "apprentice",
//       approvalStatus: "pending",
//       "wioaQuestionnaire.completed": true,
//     });

//     res.status(200).json({
//       success: true,
//       count: apprentices.length,
//       total,
//       totalPages: Math.ceil(total / limit),
//       currentPage: page,
//       data: apprentices,
//     });
//   } catch (error) {
//     console.error("Error fetching pending apprentices:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error while fetching pending apprentices",
//     });
//   }
// };

// // Approve an apprentice
// exports.approveApprentice = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { approvedBy } = req.body;

//     const apprentice = await User.findById(id);

//     if (!apprentice) {
//       return res.status(404).json({
//         success: false,
//         message: "Apprentice not found",
//       });
//     }

//     if (apprentice.role !== "apprentice") {
//       return res.status(400).json({
//         success: false,
//         message: "User is not an apprentice",
//       });
//     }

//     if (!apprentice.wioaQuestionnaire.completed) {
//       return res.status(400).json({
//         success: false,
//         message: "Apprentice has not completed WIOA questionnaire",
//       });
//     }

//     if (apprentice.approvalStatus === "approved") {
//       return res.status(400).json({
//         success: false,
//         message: "Apprentice is already approved",
//       });
//     }

//     apprentice.approvalStatus = "approved";
//     apprentice.approvalDate = new Date();
//     apprentice.approvedBy = approvedBy || req.userId;

//     await apprentice.save();

//     // Send notification to apprentice (you would implement this)
//     // sendApprovalNotification(apprentice);

//     res.status(200).json({
//       success: true,
//       message: "Apprentice approved successfully",
//       data: apprentice,
//     });
//   } catch (error) {
//     console.error("Error approving apprentice:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error while approving apprentice",
//     });
//   }
// };

// // Reject an apprentice
// exports.rejectApprentice = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { rejectionReason, rejectedBy } = req.body;

//     if (!rejectionReason) {
//       return res.status(400).json({
//         success: false,
//         message: "Rejection reason is required",
//       });
//     }

//     const apprentice = await User.findById(id);

//     if (!apprentice) {
//       return res.status(404).json({
//         success: false,
//         message: "Apprentice not found",
//       });
//     }

//     if (apprentice.role !== "apprentice") {
//       return res.status(400).json({
//         success: false,
//         message: "User is not an apprentice",
//       });
//     }

//     if (apprentice.approvalStatus === "rejected") {
//       return res.status(400).json({
//         success: false,
//         message: "Apprentice is already rejected",
//       });
//     }

//     apprentice.approvalStatus = "rejected";
//     apprentice.approvalDate = new Date();
//     apprentice.approvedBy = rejectedBy || req.userId;
//     apprentice.rejectionReason = rejectionReason;

//     await apprentice.save();

//     // Send rejection notification to apprentice (you would implement this)
//     // sendRejectionNotification(apprentice, rejectionReason);

//     res.status(200).json({
//       success: true,
//       message: "Apprentice rejected successfully",
//       data: apprentice,
//     });
//   } catch (error) {
//     console.error("Error rejecting apprentice:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error while rejecting apprentice",
//     });
//   }
// };

// // Get apprentice approval status
// exports.getApprovalStatus = async (req, res) => {
//   try {
//     const userId = req.userId;

//     const user = await User.findById(userId)
//       .populate("wioaQuestionnaire.data")
//       .select(
//         "approvalStatus approvalDate approvedBy rejectionReason wioaQuestionnaire"
//       );

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       data: {
//         approvalStatus: user.approvalStatus,
//         approvalDate: user.approvalDate,
//         approvedBy: user.approvedBy,
//         rejectionReason: user.rejectionReason,
//         wioaCompleted: user.wioaQuestionnaire.completed,
//       },
//     });
//   } catch (error) {
//     console.error("Error fetching approval status:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error while fetching approval status",
//     });
//   }
// };

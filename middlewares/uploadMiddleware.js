const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Create uploads directory if it doesn't exist
const uploadDir = "uploads/";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for local storage (temporary)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, extension);

    // Create safe filename
    const safeName = baseName.replace(/[^a-zA-Z0-9]/g, "_");
    cb(null, safeName + "-" + uniqueSuffix + extension);
  },
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase(),
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(
      new Error("Only image files (jpeg, jpg, png, gif, webp) are allowed!"),
      false,
    );
  }
};

// Create upload instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

/**
 * Middleware to handle file upload and Cloudinary processing
 * @param {Array} fields - Array of field names
 */
const handleFileUpload = (fields) => {
  const uploadMiddleware = upload.fields(fields);

  return async (req, res, next) => {
    try {
      // First, process the file upload
      uploadMiddleware(req, res, async (err) => {
        if (err) {
          return res.status(400).json({
            success: false,
            message: err.message,
          });
        }

        // If files were uploaded, process them with Cloudinary
        if (req.files) {
          const { uploadToCloudinary } = require("../utils/cloudinary");

          // Process each uploaded file
          for (const fieldName in req.files) {
            const file = req.files[fieldName][0];

            try {
              // Upload to Cloudinary
              const result = await uploadToCloudinary(
                file.path,
                fieldName === "profileImage"
                  ? "profile_images"
                  : "company_logos",
              );

              // Store Cloudinary result in req.fileData
              if (!req.fileData) req.fileData = {};
              req.fileData[fieldName] = {
                url: result.url,
                public_id: result.public_id,
                originalname: file.originalname,
                mimetype: file.mimetype,
              };
            } catch (cloudinaryError) {
              console.error(
                `Cloudinary upload error for ${fieldName}:`,
                cloudinaryError,
              );
              // Don't fail the request, just log the error
            }
          }
        }

        next();
      });
    } catch (error) {
      console.error("File upload middleware error:", error);
      next(error);
    }
  };
};

module.exports = {
  upload,
  handleFileUpload,
};

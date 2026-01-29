const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a file to Cloudinary
 * @param {String} filePath - Path to the file
 * @param {String} folder - Folder name in Cloudinary
 * @returns {Object} Upload result
 */
const uploadToCloudinary = async (filePath, folder = "profile_images") => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: "auto",
      transformation: [
        { width: 500, height: 500, crop: "limit" }, // Resize image
        { quality: "auto:good" }, // Optimize quality
      ],
    });

    // Delete local file after upload
    const fs = require("fs");
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return {
      url: result.secure_url,
      public_id: result.public_id,
    };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw new Error("Failed to upload file to Cloudinary");
  }
};

/**
 * Delete a file from Cloudinary
 * @param {String} publicId - Public ID of the file
 * @returns {Object} Delete result
 */
const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    throw new Error("Failed to delete file from Cloudinary");
  }
};

/**
 * Extract public ID from Cloudinary URL
 * @param {String} url - Cloudinary URL
 * @returns {String} Public ID
 */
const extractPublicId = (url) => {
  if (!url) return null;

  // Extract the public ID from the URL
  const parts = url.split("/");
  const filename = parts[parts.length - 1];
  return filename.split(".")[0]; // Remove file extension
};

module.exports = {
  cloudinary,
  uploadToCloudinary,
  deleteFromCloudinary,
  extractPublicId,
};

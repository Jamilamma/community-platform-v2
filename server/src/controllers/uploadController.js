const cloudinary = require("../config/cloudinary");
const { toDoc, updateById } = require("../utils/db");
const streamifier = require("streamifier");
const path = require("path");

function uploadToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      options,
      (err, result) => (err ? reject(err) : resolve(result))
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

async function uploadResume(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const allowedTypes = ["application/pdf", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ message: "Only PDF or Word documents are allowed" });
    }
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ message: "File must be under 5MB" });
    }

    const ext = path.extname(req.file.originalname) || "";
    const baseName = path
      .basename(req.file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 60);
    const publicId = `${req.user._id}_${Date.now()}_${baseName}${ext}`;

    // Cloudinary blocks PDF/ZIP delivery through the "image" pipeline
    // (security restriction — causes a 401 "deny or ACL failure"), so
    // resumes always go through "raw". Raw delivery works fine, it just
    // always downloads instead of opening inline — that's handled by the
    // /api/resume/view proxy route instead of fighting Cloudinary here.
    const result = await uploadToCloudinary(req.file.buffer, {
      resource_type: "raw",
      folder: "resumes",
      public_id: publicId,
    });

    const user = toDoc(
      await updateById(
        "users",
        req.user._id,
        { resume_url: result.secure_url, resume_name: req.file.originalname },
        "id, resume_url, resume_name"
      )
    );

    res.json({ resumeUrl: user.resumeUrl, resumeName: user.resumeName });
  } catch (err) {
    next(err);
  }
}

async function uploadPoster(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ message: "Only JPG, PNG or WEBP images are allowed" });
    }
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ message: "Image must be under 5MB" });
    }

    const result = await uploadToCloudinary(req.file.buffer, {
      resource_type: "image",
      folder: "posters",
      transformation: [{ width: 1200, height: 630, crop: "limit" }],
    });

    res.json({ posterUrl: result.secure_url });
  } catch (err) {
    next(err);
  }
}

module.exports = { uploadResume, uploadPoster };
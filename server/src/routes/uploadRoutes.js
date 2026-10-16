const router = require("express").Router();
const multer = require("multer");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const { uploadResume, uploadPoster } = require("../controllers/uploadController");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post("/resume", auth, requireRole("student"), upload.single("resume"), uploadResume);
router.post("/poster", auth, requireRole("staff"), upload.single("poster"), uploadPoster);

module.exports = router;
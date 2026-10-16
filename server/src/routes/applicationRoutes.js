const router = require("express").Router();
const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const c = require("../controllers/applicationController");

router.get("/mine", auth, requireRole("student"), c.myApplications);
router.get("/", auth, requireRole("staff"), c.list);
router.patch("/:id/status", auth, requireRole("staff"), c.updateStatus);

module.exports = router;

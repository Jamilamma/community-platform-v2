const router = require("express").Router();
const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const c = require("../controllers/analyticsController");

router.get("/staff", auth, requireRole("staff"), c.staffAnalytics);

module.exports = router;

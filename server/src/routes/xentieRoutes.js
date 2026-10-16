const router = require("express").Router();
const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const c = require("../controllers/xentieController");

// Students and staff only (the platform has no other role). Everything inside is
// filtered by the logged-in user, so no one can reach another person's private data.
router.post("/chat", auth, requireRole("student", "staff"), c.chat);

module.exports = router;

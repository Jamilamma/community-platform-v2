const router = require("express").Router();
const auth = require("../middleware/auth");
const { viewResume } = require("../controllers/resumeController");

router.get("/view", auth, viewResume);

module.exports = router;
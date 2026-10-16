const router = require("express").Router();
const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const c = require("../controllers/channelController");

router.get("/", auth, c.list);
router.post("/", auth, requireRole("staff"), c.create);
router.delete("/:id", auth, requireRole("staff"), c.remove);

module.exports = router;

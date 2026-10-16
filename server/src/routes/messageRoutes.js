const router = require("express").Router();
const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const { listByChannel, remove } = require("../controllers/messageController");

router.get("/:channelId", auth, listByChannel);
router.delete("/:id", auth, requireRole("staff"), remove);

module.exports = router;

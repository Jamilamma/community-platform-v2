const router = require("express").Router();
const auth = require("../middleware/auth");
const { myNotifications, markRead } = require("../controllers/notificationController");

router.get("/", auth, myNotifications);
router.patch("/:id/read", auth, markRead);

module.exports = router;

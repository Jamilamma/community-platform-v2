const router = require("express").Router();
const auth = require("../middleware/auth");
const c = require("../controllers/commentController");

router.get("/:messageId", auth, c.listByMessage);
router.post("/:messageId", auth, c.create);
router.delete("/:id", auth, c.remove); // controller checks staff-or-own-author

module.exports = router;

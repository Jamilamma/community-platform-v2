const router = require("express").Router();
const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const c = require("../controllers/internshipController");

router.get("/", c.list);
router.get("/:id", c.getOne);
router.post("/", auth, requireRole("staff"), c.create);
router.put("/:id", auth, requireRole("staff"), c.update);
router.delete("/:id", auth, requireRole("staff"), c.remove);
router.post("/:id/apply", auth, requireRole("student"), c.apply);

module.exports = router;

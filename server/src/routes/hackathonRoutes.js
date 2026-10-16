const router = require("express").Router();
const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const c = require("../controllers/hackathonController");

router.get("/", c.list);
router.get("/mine", auth, requireRole("student"), c.myRegistrations);
router.get("/:id", c.getOne);
router.post("/", auth, requireRole("staff"), c.create);
router.put("/:id", auth, requireRole("staff"), c.update);
router.delete("/:id", auth, requireRole("staff"), c.remove);
router.post("/:id/register", auth, requireRole("student"), c.register);
router.get("/:id/registrations", auth, requireRole("staff"), c.registrationsFor);

module.exports = router;

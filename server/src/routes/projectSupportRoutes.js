const router = require("express").Router();
const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const c = require("../controllers/projectSupportController");

// student
router.post("/", auth, requireRole("student"), c.create);
router.get("/mine", auth, requireRole("student"), c.mine);

// staff (Xentwin Technologies staff — not admin)
router.get("/", auth, requireRole("staff"), c.list);
router.post("/:id/take", auth, requireRole("staff"), c.take);
router.patch("/:id/notes", auth, requireRole("staff"), c.saveNotes);
router.patch("/:id/status", auth, requireRole("staff"), c.updateStatus);
router.post("/:id/complete", auth, requireRole("staff"), c.complete);

// shared conversation + details (ownership / assignment enforced in the controller)
router.get("/:id", auth, requireRole("student", "staff"), c.getOne);
router.post("/:id/messages", auth, requireRole("student", "staff"), c.postMessage);

module.exports = router;

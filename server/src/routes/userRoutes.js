const router = require("express").Router();
const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const requireOwner = require("../middleware/owner");
const c = require("../controllers/userController");

// staff: students
router.get("/students", auth, requireRole("staff"), c.listStudents);
router.get("/students/:id", auth, requireRole("staff"), c.getStudent);

// owner-only staff management
router.get("/staff", auth, requireOwner, c.listStaff);
router.post("/staff", auth, requireOwner, c.createStaff);
router.patch("/staff/:id/password", auth, requireOwner, c.resetStaffPassword);
router.patch("/staff/:id/active", auth, requireOwner, c.setStaffActive);

// student: own profile
router.put("/profile", auth, requireRole("student"), c.updateProfile);

module.exports = router;
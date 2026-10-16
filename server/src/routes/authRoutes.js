const router = require("express").Router();
const { register, login, me, forgotPassword, setPassword } = require("../controllers/authController");
const auth = require("../middleware/auth");
const rateLimit = require("../middleware/rateLimit");

const emailLimit = rateLimit({ max: 5 });      // register / forgot password: 5 per 15 min per IP
const loginLimit = rateLimit({ max: 20 });     // login: 20 per 15 min per IP
const tokenLimit = rateLimit({ max: 10 });     // set-password: 10 per 15 min per IP

router.post("/register", emailLimit, register);
router.post("/login", loginLimit, login);
router.post("/forgot-password", emailLimit, forgotPassword);
router.post("/set-password", tokenLimit, setPassword);
router.get("/me", auth, me);

module.exports = router;
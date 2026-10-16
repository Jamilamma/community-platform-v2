// Only the owner staff account(s) may pass (users.is_owner = true).
module.exports = function requireOwner(req, res, next) {
  if (req.user && req.user.role === "staff" && req.user.isOwner === true) return next();
  return res.status(403).json({ message: "Only the owner can manage staff accounts" });
};
const router = require("express").Router();
const c = require("../controllers/opportunityController");

// Public unified read-only view across internships/workshops/events/hackathons.
// Writes still go through each type's own route (/internships, /workshops, ...).
router.get("/", c.list);

module.exports = router;

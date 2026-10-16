const {
  supabase, toDoc, unwrap, pickRow, searchTerm, fetchAll, findById, updateById, deleteById, httpError,
} = require("../utils/db");
const { createNotification } = require("../services/notificationService");

const FIELDS = {
  name: "req", theme: "text", description: "req", date: "date", registrationDeadline: "date",
  teamSize: "text", mode: "enum", venue: "text", meetingLink: "text", prizeInfo: "text",
  rules: "text", eligibility: "text", posterUrl: "text",
};

// Older clients / records used "Remote" / "On-site"; the current wording is Online / Offline.
const LEGACY_MODES = { Remote: "Online", "On-site": "Offline" };

function hackathonRow(body) {
  const row = pickRow(body, FIELDS);
  if (row.mode) row.mode = LEGACY_MODES[row.mode] || row.mode;
  if (row.meeting_link && !/^https?:\/\//i.test(row.meeting_link)) {
    throw httpError(400, "Online meeting link must start with http:// or https://");
  }
  return row;
}

async function list(req, res, next) {
  try {
    const s = searchTerm(req.query.search);
    const hackathons = await fetchAll(() => {
      let q = supabase.from("hackathons").select("*").order("date").order("id");
      if (s) q = q.ilike("name", `%${s}%`);
      return q;
    });
    res.json(toDoc(hackathons));
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const hackathon = await findById("hackathons", req.params.id);
    if (!hackathon) return res.status(404).json({ message: "Hackathon not found" });
    res.json(toDoc(hackathon));
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const row = { ...hackathonRow(req.body), created_by: req.user._id };
    res.status(201).json(toDoc(unwrap(await supabase.from("hackathons").insert(row).select().single())));
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const hackathon = await updateById("hackathons", req.params.id, hackathonRow(req.body));
    if (!hackathon) return res.status(404).json({ message: "Hackathon not found" });
    res.json(toDoc(hackathon));
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const hackathon = await deleteById("hackathons", req.params.id);
    if (!hackathon) return res.status(404).json({ message: "Hackathon not found" });
    res.json({ message: "Hackathon deleted" });
  } catch (err) { next(err); }
}

async function register(req, res, next) {
  try {
    const hackathon = await findById("hackathons", req.params.id, "id");
    if (!hackathon) return res.status(404).json({ message: "Hackathon not found" });

    const {
      teamName, leaderName, leaderEmail, phone, teamMembers, college,
      projectTitle, projectDescription, githubLink, agreedToRules,
    } = req.body;

    const required = { teamName, leaderName, leaderEmail, phone, teamMembers, college };
    for (const [key, value] of Object.entries(required)) {
      if (!value?.toString().trim()) {
        return res.status(400).json({ message: `${key} is required` });
      }
    }
    if (!agreedToRules) {
      return res.status(400).json({ message: "You must agree to the hackathon rules" });
    }

    const reg = unwrap(
      await supabase.from("hackathon_registrations").insert({
        student_id: req.user._id,
        hackathon_id: hackathon.id,
        team_name: teamName.trim(),
        leader_name: leaderName.trim(),
        leader_email: leaderEmail.trim(),
        phone: phone.trim(),
        team_members: teamMembers.trim(),
        college: college.trim(),
        project_title: projectTitle?.trim() || "",
        project_description: projectDescription?.trim() || "",
        github_link: githubLink?.trim() || "",
        agreed_to_rules: true,
      }).select().single()
    );

    await createNotification(
      req.user._id,
      "hackathon_registration",
      "Your hackathon registration is confirmed.",
      req.app.get("io")
    );

    res.status(201).json(toDoc(reg));
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ message: "Already registered for this hackathon" });
    next(err);
  }
}

// student: my hackathon registrations
async function myRegistrations(req, res, next) {
  try {
    const registrations = unwrap(
      await supabase.from("hackathon_registrations")
        .select("*, hackathon:hackathons!hackathon_id(id, name, organization, org_label, date, registration_deadline, team_size)")
        .eq("student_id", req.user._id)
        .order("created_at")
    );
    res.json(toDoc(registrations));
  } catch (err) { next(err); }
}

// staff: view registrants for a hackathon
async function registrationsFor(req, res, next) {
  try {
    const registrations = await fetchAll(() =>
      supabase.from("hackathon_registrations")
        .select("*, student:users!student_id(id, name, email, university, course)")
        .eq("hackathon_id", req.params.id)
        .order("created_at").order("id")
    );
    res.json(toDoc(registrations));
  } catch (err) { next(err); }
}

module.exports = { list, getOne, create, update, remove, register, myRegistrations, registrationsFor };

const { supabase, toDoc, unwrap, fetchAll } = require("../utils/db");
const { createNotification } = require("../services/notificationService");

// student: my applications
async function myApplications(req, res, next) {
  try {
    const applications = unwrap(
      await supabase.from("applications")
        .select("*, internship:internships!internship_id(id, title, organization, org_label, deadline)")
        .eq("student_id", req.user._id)
        .order("created_at")
    );
    res.json(toDoc(applications));
  } catch (err) {
    next(err);
  }
}

// staff: view applications, optionally filter by internship
async function list(req, res, next) {
  try {
    const applications = await fetchAll(() => {
      let q = supabase.from("applications")
        .select(
          "*, student:users!student_id(id, name, email, university, course, resume_url, resume_name)," +
          " internship:internships!internship_id(id, title)"
        )
        .order("created_at").order("id");
      if (req.query.internship) q = q.eq("internship_id", req.query.internship);
      return q;
    });
    res.json(toDoc(applications));
  } catch (err) {
    next(err);
  }
}

// staff: update status -> triggers notification
async function updateStatus(req, res, next) {
  try {
    const { status } = req.body;
    const allowed = ["Applied", "Under Review", "Shortlisted", "Selected", "Rejected"];
    if (!allowed.includes(status)) return res.status(400).json({ message: "Invalid status" });

    const application = unwrap(
      await supabase.from("applications")
        .update({ status })
        .eq("id", req.params.id)
        .select("*, internship:internships!internship_id(id, title)")
        .maybeSingle()
    );
    if (!application) return res.status(404).json({ message: "Application not found" });

    await createNotification(
      application.student_id,
      "application_status_changed",
      `Your application for ${application.internship.title} is now ${status}.`,
      req.app.get("io")
    );

    res.json(toDoc(application));
  } catch (err) {
    next(err);
  }
}

module.exports = { myApplications, list, updateStatus };

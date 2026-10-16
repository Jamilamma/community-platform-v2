const { supabase, unwrap, fetchAll } = require("../utils/db");

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

async function countRows(table) {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
  unwrap({ data: null, error });
  return count || 0;
}

// Simple, readable staff analytics — no BI system, just grouped counts.
// GET /api/analytics/staff
async function staffAnalytics(req, res, next) {
  try {
    const [
      applications, workshopRegCount, eventRegCount, hackathonRegCount,
      internshipCount, workshopCount, eventCount, hackathonCount,
    ] = await Promise.all([
      fetchAll(() =>
        supabase.from("applications")
          .select("id, status, created_at, internship:internships!internship_id(title)")
          .order("created_at").order("id")
      ),
      countRows("workshop_registrations"),
      countRows("event_registrations"),
      countRows("hackathon_registrations"),
      countRows("internships"),
      countRows("workshops"),
      countRows("events"),
      countRows("hackathons"),
    ]);

    // Applications by month (last 6 months, oldest first)
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTH_LABELS[d.getMonth()], count: 0 });
    }
    applications.forEach((a) => {
      const d = new Date(a.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const bucket = months.find((m) => m.key === key);
      if (bucket) bucket.count += 1;
    });
    const applicationsByMonth = months.map(({ label, count }) => ({ label, count }));

    // Application status breakdown
    const statuses = ["Applied", "Under Review", "Shortlisted", "Selected", "Rejected"];
    const statusBreakdown = statuses.map((status) => ({
      status,
      count: applications.filter((a) => a.status === status).length,
    }));

    // Popular opportunities (by application/registration count), top 5
    const countByInternship = {};
    applications.forEach((a) => {
      if (!a.internship) return;
      const title = a.internship.title;
      countByInternship[title] = (countByInternship[title] || 0) + 1;
    });
    const popularOpportunities = Object.entries(countByInternship)
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Registrations by opportunity type
    const registrationsByType = [
      { type: "Internships", count: applications.length },
      { type: "Workshops", count: workshopRegCount },
      { type: "Events", count: eventRegCount },
      { type: "Hackathons", count: hackathonRegCount },
    ];

    // Organization activity — how many opportunities + registrations each org has
    const organizationActivity = [
      {
        organization: "Xentwin Technologies",
        opportunities: internshipCount + workshopCount,
        engagement: applications.length + workshopRegCount,
      },
      {
        organization: "GenAura Technologies",
        opportunities: eventCount + hackathonCount,
        engagement: eventRegCount + hackathonRegCount,
      },
    ];

    res.json({
      applicationsByMonth,
      statusBreakdown,
      popularOpportunities,
      registrationsByType,
      organizationActivity,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { staffAnalytics };

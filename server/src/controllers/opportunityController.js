const { supabase, toDoc, fetchAll, searchTerm } = require("../utils/db");

// Normalizes each opportunity type into one common shape so the frontend
// can render a single unified list/search/filter experience, even though
// each type stays its own table in the database.
function normalize(doc, type) {
  const base = {
    id: doc._id,
    type, // "internship" | "workshop" | "event" | "hackathon"
    title: doc.title || doc.name,
    organization: doc.organization,
    orgLabel: doc.orgLabel,
    description: doc.description,
    mode: doc.mode,
    location: doc.location || null,
    skills: doc.requiredSkills || [],
    createdAt: doc.createdAt,
  };

  if (type === "internship") {
    return { ...base, deadline: doc.deadline, duration: doc.duration, date: null };
  }
  if (type === "workshop") {
    return { ...base, deadline: doc.registrationDeadline, date: doc.date, time: doc.time };
  }
  if (type === "event") {
    return { ...base, deadline: doc.registrationDeadline, date: doc.date, time: doc.time };
  }
  // hackathon
  return { ...base, deadline: doc.registrationDeadline, date: doc.date, teamSize: doc.teamSize };
}

const TYPE_TO_ORG = {
  internship: "Xentwin Technologies",
  workshop: "Xentwin Technologies",
  event: "GenAura Technologies",
  hackathon: "GenAura Technologies",
};

// Newest first. `columns` are the text columns matched (case-insensitive substring) by `search`.
const fetchType = (table, columns, s) =>
  fetchAll(() => {
    let q = supabase.from(table).select("*").order("created_at", { ascending: false }).order("id");
    if (s) q = q.or(columns.map((c) => `${c}.ilike."%${s}%"`).join(","));
    return q;
  });

// GET /api/opportunities?search=&type=all|internship|workshop|event|hackathon&organization=all|Xentwin Technologies|GenAura Technologies
async function list(req, res, next) {
  try {
    const { type, organization } = req.query;
    const s = searchTerm(req.query.search);
    const wantedType = type && type !== "all" ? type : null;
    const wantedOrg = organization && organization !== "all" ? organization : null;

    // Skip querying a table entirely when the type/org filter rules it out —
    // avoids invalid combinations like "Xentwin" + "hackathon".
    const includeInternships = (!wantedType || wantedType === "internship") && (!wantedOrg || wantedOrg === "Xentwin Technologies");
    const includeWorkshops = (!wantedType || wantedType === "workshop") && (!wantedOrg || wantedOrg === "Xentwin Technologies");
    const includeEvents = (!wantedType || wantedType === "event") && (!wantedOrg || wantedOrg === "GenAura Technologies");
    const includeHackathons = (!wantedType || wantedType === "hackathon") && (!wantedOrg || wantedOrg === "GenAura Technologies");

    const [internships, workshops, events, hackathons] = await Promise.all([
      includeInternships
        // internships also match on required skills (a text[] column), which can't be
        // ILIKE'd in a PostgREST filter, so that table is filtered in JS instead.
        ? fetchType("internships", [], "").then((rows) => {
            if (!s) return rows;
            const needle = s.toLowerCase();
            return rows.filter((r) =>
              [r.title, r.description, ...(r.required_skills || [])]
                .some((v) => v && String(v).toLowerCase().includes(needle))
            );
          })
        : [],
      includeWorkshops ? fetchType("workshops", ["title", "description"], s) : [],
      includeEvents ? fetchType("events", ["title", "description"], s) : [],
      includeHackathons ? fetchType("hackathons", ["name", "description", "theme"], s) : [],
    ]);

    const combined = [
      ...toDoc(internships).map((d) => normalize(d, "internship")),
      ...toDoc(workshops).map((d) => normalize(d, "workshop")),
      ...toDoc(events).map((d) => normalize(d, "event")),
      ...toDoc(hackathons).map((d) => normalize(d, "hackathon")),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(combined);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, TYPE_TO_ORG };

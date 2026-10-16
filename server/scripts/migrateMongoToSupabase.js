// One-time data migration: MongoDB (old) -> Supabase Postgres (new).
//
// Only needed if you have existing data in MongoDB you want to keep.
//
//   1. Run supabase/schema.sql in Supabase first.
//   2. cd server && npm install --no-save mongodb
//   3. Put BOTH sets of variables in server/.env for the duration of the migration:
//        MONGO_URI=...   SUPABASE_URL=...   SUPABASE_SERVICE_ROLE_KEY=...
//   4. npm run migrate:mongo            (add --dry-run to only print counts)
//
// Every document gets a fresh UUID; references between collections are rewritten.
// Existing JWTs stop working afterwards (their ids were Mongo ObjectIds) — users just log in again.
require("dotenv").config();
const crypto = require("crypto");

let MongoClient;
try {
  ({ MongoClient } = require("mongodb"));
} catch {
  console.error("The `mongodb` package is required for this script:  npm install --no-save mongodb");
  process.exit(1);
}
const supabase = require("../src/config/supabase");

const DRY_RUN = process.argv.includes("--dry-run");
const LEGACY_MODES = { Remote: "Online", "On-site": "Offline" };

const idMap = new Map(); // "collection:oldId" -> uuid
const newId = (col, oldId) => {
  const k = `${col}:${oldId}`;
  if (!idMap.has(k)) idMap.set(k, crypto.randomUUID());
  return idMap.get(k);
};
const ref = (col, oldId) => (oldId ? idMap.get(`${col}:${oldId}`) || null : null);
const ts = (d) => (d ? new Date(d).toISOString() : undefined);
const base = (col, d) => ({ id: newId(col, d._id), created_at: ts(d.createdAt), updated_at: ts(d.updatedAt) });

// Each entry: mongo collection, postgres table, row builder, required refs (rows with dangling refs are skipped)
const PLAN = [
  {
    col: "users", table: "users",
    row: (d) => ({
      ...base("users", d), name: d.name, email: String(d.email).trim().toLowerCase(),
      password_hash: d.passwordHash, role: d.role, phone: d.phone, university: d.university,
      course: d.course, year: d.year, skills: d.skills || [], resume_url: d.resumeUrl, resume_name: d.resumeName,
    }),
  },
  { col: "channels", table: "channels", row: (d) => ({ ...base("channels", d), name: d.name, description: d.description }) },
  {
    col: "internships", table: "internships", needs: { created_by: "users" },
    row: (d) => ({
      ...base("internships", d), title: d.title, description: d.description,
      responsibilities: d.responsibilities || [], required_skills: d.requiredSkills || [],
      eligibility: d.eligibility, duration: d.duration, mode: d.mode, location: d.location,
      openings: d.openings, deadline: ts(d.deadline), created_by: ref("users", d.createdBy),
    }),
  },
  {
    col: "workshops", table: "workshops", needs: { created_by: "users" },
    row: (d) => ({
      ...base("workshops", d), title: d.title, description: d.description, date: ts(d.date), time: d.time,
      instructor: d.instructor, mode: d.mode, seats: d.seats,
      registration_deadline: ts(d.registrationDeadline), poster_url: d.posterUrl, created_by: ref("users", d.createdBy),
    }),
  },
  {
    col: "events", table: "events", needs: { created_by: "users" },
    row: (d) => ({
      ...base("events", d), title: d.title, description: d.description, date: ts(d.date), time: d.time,
      location: d.location, mode: d.mode, capacity: d.capacity,
      registration_deadline: ts(d.registrationDeadline), poster_url: d.posterUrl, created_by: ref("users", d.createdBy),
    }),
  },
  {
    col: "hackathons", table: "hackathons", needs: { created_by: "users" },
    row: (d) => ({
      ...base("hackathons", d), name: d.name, theme: d.theme, description: d.description, date: ts(d.date),
      registration_deadline: ts(d.registrationDeadline), team_size: d.teamSize,
      mode: LEGACY_MODES[d.mode] || d.mode, venue: d.venue, meeting_link: d.meetingLink,
      prize_info: d.prizeInfo, rules: d.rules, eligibility: d.eligibility, poster_url: d.posterUrl,
      created_by: ref("users", d.createdBy),
    }),
  },
  {
    col: "applications", table: "applications", needs: { student_id: "users", internship_id: "internships" },
    row: (d) => ({
      ...base("applications", d), student_id: ref("users", d.student), internship_id: ref("internships", d.internship),
      status: d.status, resume_url: d.resumeUrl, resume_name: d.resumeName,
    }),
  },
  {
    col: "workshopregistrations", table: "workshop_registrations", needs: { student_id: "users", workshop_id: "workshops" },
    row: (d) => ({ ...base("workshopregistrations", d), student_id: ref("users", d.student), workshop_id: ref("workshops", d.workshop) }),
  },
  {
    col: "eventregistrations", table: "event_registrations", needs: { student_id: "users", event_id: "events" },
    row: (d) => ({ ...base("eventregistrations", d), student_id: ref("users", d.student), event_id: ref("events", d.event) }),
  },
  {
    col: "hackathonregistrations", table: "hackathon_registrations", needs: { student_id: "users", hackathon_id: "hackathons" },
    row: (d) => ({
      ...base("hackathonregistrations", d), student_id: ref("users", d.student), hackathon_id: ref("hackathons", d.hackathon),
      team_name: d.teamName, leader_name: d.leaderName, leader_email: d.leaderEmail, phone: d.phone,
      team_members: d.teamMembers, college: d.college, project_title: d.projectTitle,
      project_description: d.projectDescription, github_link: d.githubLink, agreed_to_rules: !!d.agreedToRules,
    }),
  },
  {
    col: "messages", table: "messages", needs: { channel_id: "channels", sender_id: "users" },
    row: (d) => ({ ...base("messages", d), channel_id: ref("channels", d.channel), sender_id: ref("users", d.sender), text: d.text }),
  },
  {
    col: "comments", table: "comments", needs: { message_id: "messages", author_id: "users" },
    row: (d) => ({ ...base("comments", d), message_id: ref("messages", d.message), author_id: ref("users", d.author), text: d.text }),
  },
  {
    col: "announcements", table: "announcements", needs: { created_by: "users" },
    row: (d) => ({ ...base("announcements", d), title: d.title, body: d.body, created_by: ref("users", d.createdBy) }),
  },
  {
    col: "notifications", table: "notifications", needs: { user_id: "users" },
    row: (d) => ({ ...base("notifications", d), user_id: ref("users", d.user), type: d.type, message: d.message, read: !!d.read }),
  },
];

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set");

  if (!DRY_RUN) {
    const { count, error } = await supabase.from("users").select("id", { count: "exact", head: true });
    if (error) throw error;
    if (count > 0) throw new Error("Supabase `users` table is not empty — refusing to migrate on top of existing data.");
  }

  const mongo = new MongoClient(process.env.MONGO_URI);
  await mongo.connect();
  const db = mongo.db(); // database named in the URI (same one Mongoose used)

  // Assign ids up front so references resolve regardless of insert order.
  for (const step of PLAN) {
    for await (const d of db.collection(step.col).find({}, { projection: { _id: 1 } })) newId(step.col, d._id);
  }

  for (const step of PLAN) {
    const docs = await db.collection(step.col).find({}).sort({ createdAt: 1 }).toArray();
    const rows = [];
    let skipped = 0;
    for (const d of docs) {
      const row = step.row(d);
      if (Object.entries(step.needs || {}).some(([column]) => !row[column])) { skipped++; continue; }
      // drop undefined so column defaults apply
      Object.keys(row).forEach((k) => row[k] === undefined && delete row[k]);
      rows.push(row);
    }
    console.log(`${step.col.padEnd(24)} ${String(docs.length).padStart(6)} docs -> ${step.table}` +
      (skipped ? `  (${skipped} skipped: dangling reference)` : ""));

    if (DRY_RUN) continue;
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from(step.table).insert(rows.slice(i, i + 500));
      if (error) throw new Error(`${step.table}: ${error.message}`);
    }
  }

  await mongo.close();
  console.log(DRY_RUN ? "\nDry run only — nothing written." : "\nMigration complete.");
}

main().catch((err) => {
  console.error("Migration failed:", err.message || err);
  process.exit(1);
});

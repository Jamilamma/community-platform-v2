const bcrypt = require("bcryptjs");
const {
  supabase, toDoc, unwrap, pickRow, searchTerm, fetchAll, updateById, httpError, USER_PUBLIC,
} = require("../utils/db");

// staff: list/search students
async function listStudents(req, res, next) {
  try {
    const s = searchTerm(req.query.search);
    const students = await fetchAll(() => {
      let q = supabase.from("users").select(USER_PUBLIC).eq("role", "student")
        .order("created_at").order("id");
      if (s) q = q.ilike("name", `%${s}%`);
      return q;
    });
    res.json(toDoc(students));
  } catch (err) { next(err); }
}

async function getStudent(req, res, next) {
  try {
    const student = unwrap(
      await supabase.from("users").select(USER_PUBLIC)
        .eq("id", req.params.id).eq("role", "student").maybeSingle()
    );
    if (!student) return res.status(404).json({ message: "Student not found" });

    const applications = unwrap(
      await supabase.from("applications")
        .select("*, internship:internships!internship_id(id, title)")
        .eq("student_id", student.id)
        .order("created_at")
    );
    res.json({ student: toDoc(student), applications: toDoc(applications) });
  } catch (err) { next(err); }
}

// student: update own profile
async function updateProfile(req, res, next) {
  try {
    const row = pickRow(req.body, {
      name: "req", phone: "text", university: "text", course: "text", year: "text", skills: "array",
    });
    if (row.name !== undefined && !row.name.trim()) throw httpError(400, "name is required");

    const user = await updateById("users", req.user._id, row, USER_PUBLIC);
    res.json(toDoc(user));
  } catch (err) { next(err); }
}

// ---------------------------------------------------------------- staff accounts (staff only)

const normalizeEmail = (e) => String(e || "").trim().toLowerCase();

// staff: list all staff accounts
async function listStaff(req, res, next) {
  try {
    const rows = unwrap(
      await supabase.from("users").select("id, name, email, role, is_owner, is_active, created_at")
        .eq("role", "staff").order("created_at")
    );
    res.json(toDoc(rows));
  } catch (err) { next(err); }
}

// staff: create a new staff account { name, email, password }
async function createStaff(req, res, next) {
  try {
    const name = String(req.body.name || "").trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    if (!name || !email || !password) throw httpError(400, "Name, email and password are required");
    if (!/^\S+@\S+\.\S+$/.test(email)) throw httpError(400, "Enter a valid email");
    if (password.length < 8) throw httpError(400, "Password must be at least 8 characters");

    const existing = unwrap(await supabase.from("users").select("id").eq("email", email).maybeSingle());
    if (existing) throw httpError(409, "This email is already registered");

    const passwordHash = await bcrypt.hash(password, 10);
    const created = unwrap(
      await supabase.from("users")
        .insert({ name, email, password_hash: passwordHash, role: "staff" })
        .select("id, name, email, role, is_owner, is_active, created_at").single()
    );
    res.status(201).json(toDoc(created));
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ message: "This email is already registered" });
    next(err);
  }
}

// staff: reset another staff member's password { password }
async function resetStaffPassword(req, res, next) {
  try {
    const password = String(req.body.password || "");
    if (password.length < 8) throw httpError(400, "Password must be at least 8 characters");
    const passwordHash = await bcrypt.hash(password, 10);
    const updated = unwrap(
      await supabase.from("users").update({ password_hash: passwordHash })
        .eq("id", req.params.id).eq("role", "staff").select("id").maybeSingle()
    );
    if (!updated) throw httpError(404, "Staff account not found");
    res.json({ message: "Password updated" });
  } catch (err) { next(err); }
}

// owner: disable / re-enable a staff account { active: boolean }
// A disabled account cannot log in and its existing sessions stop working immediately.
// All of its data (internships, announcements, ...) is kept.
async function setStaffActive(req, res, next) {
  try {
    const active = req.body.active === true;
    if (req.params.id === req.user._id) throw httpError(400, "You cannot disable your own account");

    const target = unwrap(
      await supabase.from("users").select("id, is_owner").eq("id", req.params.id).eq("role", "staff").maybeSingle()
    );
    if (!target) throw httpError(404, "Staff account not found");
    if (target.is_owner) throw httpError(400, "An owner account cannot be disabled");

    unwrap(await supabase.from("users").update({ is_active: active }).eq("id", target.id));
    res.json({ message: active ? "Account enabled" : "Account disabled" });
  } catch (err) { next(err); }
}

module.exports = { listStudents, getStudent, updateProfile, listStaff, createStaff, resetStaffPassword, setStaffActive };
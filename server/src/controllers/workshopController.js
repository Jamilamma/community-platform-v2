const {
  supabase, toDoc, unwrap, pickRow, searchTerm, fetchAll, findById, updateById, deleteById,
} = require("../utils/db");
const { createNotification } = require("../services/notificationService");

const FIELDS = {
  title: "req", description: "req", date: "date", time: "text", instructor: "text",
  mode: "enum", seats: "number", registrationDeadline: "date", posterUrl: "text",
};

async function list(req, res, next) {
  try {
    const s = searchTerm(req.query.search);
    const workshops = await fetchAll(() => {
      let q = supabase.from("workshops").select("*").order("date").order("id");
      if (s) q = q.ilike("title", `%${s}%`);
      return q;
    });
    res.json(toDoc(workshops));
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const workshop = await findById("workshops", req.params.id);
    if (!workshop) return res.status(404).json({ message: "Workshop not found" });
    res.json(toDoc(workshop));
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const row = { ...pickRow(req.body, FIELDS), created_by: req.user._id };
    res.status(201).json(toDoc(unwrap(await supabase.from("workshops").insert(row).select().single())));
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const workshop = await updateById("workshops", req.params.id, pickRow(req.body, FIELDS));
    if (!workshop) return res.status(404).json({ message: "Workshop not found" });
    res.json(toDoc(workshop));
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const workshop = await deleteById("workshops", req.params.id);
    if (!workshop) return res.status(404).json({ message: "Workshop not found" });
    res.json({ message: "Workshop deleted" });
  } catch (err) { next(err); }
}

async function register(req, res, next) {
  try {
    const workshop = await findById("workshops", req.params.id, "id, title");
    if (!workshop) return res.status(404).json({ message: "Workshop not found" });
    const reg = unwrap(
      await supabase.from("workshop_registrations")
        .insert({ student_id: req.user._id, workshop_id: workshop.id }).select().single()
    );

    await createNotification(
      req.user._id,
      "workshop_registration",
      `Your registration for ${workshop.title} is confirmed.`,
      req.app.get("io")
    );

    res.status(201).json(toDoc(reg));
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ message: "Already registered for this workshop" });
    next(err);
  }
}

// student: my workshop registrations
async function myRegistrations(req, res, next) {
  try {
    const registrations = unwrap(
      await supabase.from("workshop_registrations")
        .select("*, workshop:workshops!workshop_id(id, title, organization, org_label, date, time, mode, registration_deadline)")
        .eq("student_id", req.user._id)
        .order("created_at")
    );
    res.json(toDoc(registrations));
  } catch (err) { next(err); }
}

// staff: view registrants for a workshop
async function registrationsFor(req, res, next) {
  try {
    const registrations = await fetchAll(() =>
      supabase.from("workshop_registrations")
        .select("*, student:users!student_id(id, name, email, university, course)")
        .eq("workshop_id", req.params.id)
        .order("created_at").order("id")
    );
    res.json(toDoc(registrations));
  } catch (err) { next(err); }
}

module.exports = { list, getOne, create, update, remove, register, myRegistrations, registrationsFor };

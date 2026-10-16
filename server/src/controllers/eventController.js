const {
  supabase, toDoc, unwrap, pickRow, searchTerm, fetchAll, findById, updateById, deleteById,
} = require("../utils/db");
const { createNotification } = require("../services/notificationService");

const FIELDS = {
  title: "req", description: "req", date: "date", time: "text", location: "text",
  mode: "enum", capacity: "number", registrationDeadline: "date", posterUrl: "text",
};

async function list(req, res, next) {
  try {
    const s = searchTerm(req.query.search);
    const events = await fetchAll(() => {
      let q = supabase.from("events").select("*").order("date").order("id");
      if (s) q = q.ilike("title", `%${s}%`);
      return q;
    });
    res.json(toDoc(events));
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const event = await findById("events", req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });
    res.json(toDoc(event));
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const row = { ...pickRow(req.body, FIELDS), created_by: req.user._id };
    res.status(201).json(toDoc(unwrap(await supabase.from("events").insert(row).select().single())));
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const event = await updateById("events", req.params.id, pickRow(req.body, FIELDS));
    if (!event) return res.status(404).json({ message: "Event not found" });
    res.json(toDoc(event));
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const event = await deleteById("events", req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });
    res.json({ message: "Event deleted" });
  } catch (err) { next(err); }
}

async function register(req, res, next) {
  try {
    const event = await findById("events", req.params.id, "id, title");
    if (!event) return res.status(404).json({ message: "Event not found" });
    const reg = unwrap(
      await supabase.from("event_registrations")
        .insert({ student_id: req.user._id, event_id: event.id }).select().single()
    );

    await createNotification(
      req.user._id,
      "event_registration",
      `Your registration for ${event.title} is confirmed.`,
      req.app.get("io")
    );

    res.status(201).json(toDoc(reg));
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ message: "Already registered for this event" });
    next(err);
  }
}

// student: my event registrations
async function myRegistrations(req, res, next) {
  try {
    const registrations = unwrap(
      await supabase.from("event_registrations")
        .select("*, event:events!event_id(id, title, organization, org_label, date, time, mode, location, registration_deadline)")
        .eq("student_id", req.user._id)
        .order("created_at")
    );
    res.json(toDoc(registrations));
  } catch (err) { next(err); }
}

// staff: view registrants for an event
async function registrationsFor(req, res, next) {
  try {
    const registrations = await fetchAll(() =>
      supabase.from("event_registrations")
        .select("*, student:users!student_id(id, name, email, university, course)")
        .eq("event_id", req.params.id)
        .order("created_at").order("id")
    );
    res.json(toDoc(registrations));
  } catch (err) { next(err); }
}

module.exports = { list, getOne, create, update, remove, register, myRegistrations, registrationsFor };

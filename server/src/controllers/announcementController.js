const {
  supabase, toDoc, unwrap, pickRow, fetchAll, deleteById,
} = require("../utils/db");
const { createNotifications } = require("../services/notificationService");

async function list(req, res, next) {
  try {
    const announcements = await fetchAll(() =>
      supabase.from("announcements").select("*").order("created_at", { ascending: false }).order("id")
    );
    res.json(toDoc(announcements));
  } catch (err) { next(err); }
}

// staff only - notifies every student
async function create(req, res, next) {
  try {
    const row = { ...pickRow(req.body, { title: "req", body: "req" }), created_by: req.user._id };
    const announcement = unwrap(await supabase.from("announcements").insert(row).select().single());

    const students = await fetchAll(() =>
      supabase.from("users").select("id").eq("role", "student").order("id")
    );
    await createNotifications(
      students.map((s) => s.id),
      "announcement",
      announcement.title,
      req.app.get("io")
    );

    res.status(201).json(toDoc(announcement));
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const announcement = await deleteById("announcements", req.params.id);
    if (!announcement) return res.status(404).json({ message: "Announcement not found" });
    res.json({ message: "Announcement deleted" });
  } catch (err) { next(err); }
}

module.exports = { list, create, remove };

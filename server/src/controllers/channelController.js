const { supabase, toDoc, unwrap, pickRow, deleteById } = require("../utils/db");

async function list(req, res, next) {
  try {
    res.json(toDoc(unwrap(await supabase.from("channels").select("*").order("name"))));
  } catch (err) { next(err); }
}

// staff only
async function create(req, res, next) {
  try {
    const row = pickRow(req.body, { name: "req", description: "text" });
    const channel = unwrap(await supabase.from("channels").insert(row).select().single());
    res.status(201).json(toDoc(channel));
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ message: "Channel already exists" });
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const channel = await deleteById("channels", req.params.id);
    if (!channel) return res.status(404).json({ message: "Channel not found" });
    res.json({ message: "Channel deleted" });
  } catch (err) { next(err); }
}

module.exports = { list, create, remove };

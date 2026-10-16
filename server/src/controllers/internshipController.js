const {
  supabase, toDoc, unwrap, pickRow, searchTerm, fetchAll, findById, updateById, deleteById,
} = require("../utils/db");

// organization / orgLabel are deliberately absent: they are fixed by DB defaults and immutable.
const FIELDS = {
  title: "req", description: "req", responsibilities: "array", requiredSkills: "array",
  eligibility: "text", duration: "text", mode: "enum", location: "text",
  openings: "number", deadline: "date",
};

async function list(req, res, next) {
  try {
    const s = searchTerm(req.query.search);
    const internships = await fetchAll(() => {
      let q = supabase.from("internships").select("*").order("created_at", { ascending: false }).order("id");
      if (s) q = q.ilike("title", `%${s}%`);
      return q;
    });
    res.json(toDoc(internships));
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const internship = await findById("internships", req.params.id);
    if (!internship) return res.status(404).json({ message: "Internship not found" });
    res.json(toDoc(internship));
  } catch (err) {
    next(err);
  }
}

// staff only
async function create(req, res, next) {
  try {
    const row = { ...pickRow(req.body, FIELDS), created_by: req.user._id };
    const internship = unwrap(await supabase.from("internships").insert(row).select().single());
    res.status(201).json(toDoc(internship));
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const internship = await updateById("internships", req.params.id, pickRow(req.body, FIELDS));
    if (!internship) return res.status(404).json({ message: "Internship not found" });
    res.json(toDoc(internship));
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const internship = await deleteById("internships", req.params.id);
    if (!internship) return res.status(404).json({ message: "Internship not found" });
    res.json({ message: "Internship deleted" });
  } catch (err) {
    next(err);
  }
}

// student only - apply with duplicate prevention (DB unique constraint also guards this)
async function apply(req, res, next) {
  try {
    const internship = await findById("internships", req.params.id, "id");
    if (!internship) return res.status(404).json({ message: "Internship not found" });

    const existing = unwrap(
      await supabase.from("applications").select("id")
        .eq("student_id", req.user._id).eq("internship_id", internship.id).maybeSingle()
    );
    if (existing) return res.status(409).json({ message: "You already applied to this internship" });

    const application = unwrap(
      await supabase.from("applications").insert({
        student_id: req.user._id,
        internship_id: internship.id,
        resume_url: req.user.resumeUrl,
        resume_name: req.user.resumeName,
      }).select().single()
    );
    res.status(201).json(toDoc(application));
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ message: "You already applied to this internship" });
    next(err);
  }
}

module.exports = { list, getOne, create, update, remove, apply };

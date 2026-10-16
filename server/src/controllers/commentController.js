const { supabase, toDoc, unwrap, findById, deleteById } = require("../utils/db");

const WITH_AUTHOR = "*, author:users!author_id(id, name, role)";

// GET /api/comments/:messageId
async function listByMessage(req, res, next) {
  try {
    const comments = unwrap(
      await supabase.from("comments")
        .select(WITH_AUTHOR)
        .eq("message_id", req.params.messageId)
        .order("created_at")
    );
    res.json(toDoc(comments));
  } catch (err) { next(err); }
}

// POST /api/comments/:messageId - student or staff
async function create(req, res, next) {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ message: "Comment text is required" });

    const comment = unwrap(
      await supabase.from("comments")
        .insert({ message_id: req.params.messageId, author_id: req.user._id, text: text.trim() })
        .select(WITH_AUTHOR)
        .single()
    );
    res.status(201).json(toDoc(comment));
  } catch (err) {
    if (err.code === "23503") return res.status(404).json({ message: "Message not found" });
    next(err);
  }
}

// DELETE /api/comments/:id - staff (moderation) or the comment's own author
async function remove(req, res, next) {
  try {
    const comment = await findById("comments", req.params.id, "id, author_id");
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    if (req.user.role !== "staff" && comment.author_id !== req.user._id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await deleteById("comments", comment.id);
    res.json({ message: "Comment removed" });
  } catch (err) { next(err); }
}

module.exports = { listByMessage, create, remove };

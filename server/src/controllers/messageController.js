const { supabase, toDoc, unwrap, deleteById } = require("../utils/db");

async function listByChannel(req, res, next) {
  try {
    const messages = unwrap(
      await supabase.from("messages")
        .select("*, sender:users!sender_id(id, name, role)")
        .eq("channel_id", req.params.channelId)
        .order("created_at")
        .limit(200)
    );
    res.json(toDoc(messages));
  } catch (err) { next(err); }
}

// staff moderation - remove an inappropriate post/message (its replies are
// removed by the ON DELETE CASCADE on comments.message_id)
async function remove(req, res, next) {
  try {
    const message = await deleteById("messages", req.params.id);
    if (!message) return res.status(404).json({ message: "Message not found" });

    const io = req.app.get("io");
    if (io) io.to(`channel:${message.channel_id}`).emit("message:deleted", message.id);

    res.json({ message: "Message removed" });
  } catch (err) { next(err); }
}

module.exports = { listByChannel, remove };

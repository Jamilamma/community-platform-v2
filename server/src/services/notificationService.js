const { supabase, toDoc, unwrap } = require("../utils/db");

async function createNotification(userId, type, message, io) {
  const row = unwrap(
    await supabase.from("notifications").insert({ user_id: userId, type, message }).select().single()
  );
  const notification = toDoc(row);
  if (io) io.to(`user:${userId}`).emit("notification:new", notification);
  return notification;
}

// Bulk version (one insert instead of one per student) — used for announcements.
async function createNotifications(userIds, type, message, io) {
  const CHUNK = 500;
  for (let i = 0; i < userIds.length; i += CHUNK) {
    const rows = userIds.slice(i, i + CHUNK).map((user_id) => ({ user_id, type, message }));
    const inserted = unwrap(await supabase.from("notifications").insert(rows).select());
    if (io) {
      inserted.forEach((n) => io.to(`user:${n.user_id}`).emit("notification:new", toDoc(n)));
    }
  }
}

module.exports = { createNotification, createNotifications };

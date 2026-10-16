const { supabase, toDoc, unwrap } = require("../utils/db");

async function myNotifications(req, res, next) {
  try {
    const notifications = unwrap(
      await supabase.from("notifications")
        .select("*")
        .eq("user_id", req.user._id)
        .order("created_at", { ascending: false })
        .limit(50)
    );
    res.json(toDoc(notifications));
  } catch (err) { next(err); }
}

async function markRead(req, res, next) {
  try {
    const notification = unwrap(
      await supabase.from("notifications")
        .update({ read: true })
        .eq("id", req.params.id)
        .eq("user_id", req.user._id)
        .select()
        .maybeSingle()
    );
    if (!notification) return res.status(404).json({ message: "Notification not found" });
    res.json(toDoc(notification));
  } catch (err) { next(err); }
}

module.exports = { myNotifications, markRead };

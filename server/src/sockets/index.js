const jwt = require("jsonwebtoken");
const { supabase, toDoc, unwrap } = require("../utils/db");

function initSockets(io) {
  // auth handshake: client sends JWT, we attach user info to the socket
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("No token"));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.role = decoded.role;
      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.userId}`); // personal room for notifications

    socket.on("channel:join", (channelId) => {
      socket.join(`channel:${channelId}`);
    });

    socket.on("channel:leave", (channelId) => {
      socket.leave(`channel:${channelId}`);
    });

    socket.on("message:send", async ({ channelId, text } = {}) => {
      if (!text || !text.trim()) return;
      try {
        const row = unwrap(
          await supabase
            .from("messages")
            .insert({ channel_id: channelId, sender_id: socket.userId, text: text.trim() })
            .select("*, sender:users!sender_id(id, name, role)")
            .single()
        );
        io.to(`channel:${channelId}`).emit("message:new", toDoc(row));
      } catch (err) {
        // A bad channel id / DB hiccup must not take the whole server down.
        console.error("message:send failed:", err.message);
      }
    });
  });
}

module.exports = initSockets;

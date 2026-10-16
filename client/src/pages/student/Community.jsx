import { useEffect, useState, useRef } from "react";
import { apiRequest } from "../../services/api";
import { getSocket } from "../../services/socket";
import { useAuth } from "../../context/AuthContext";

export default function Community() {
  const { user } = useAuth();
  const isStaff = user?.role === "staff";

  const [channels, setChannels] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [comments, setComments] = useState({}); // messageId -> [comments]
  const [replyText, setReplyText] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  const [message, setMessage] = useState("");
  const socketRef = useRef(null);

  function loadChannels() {
    apiRequest("/channels").then((data) => {
      setChannels(data);
      setActive((prev) => prev || data[0]);
    });
  }

  useEffect(() => {
    loadChannels();
    socketRef.current = getSocket();
    return () => socketRef.current.disconnect();
  }, []);

  useEffect(() => {
    if (!active?._id) return;
    apiRequest(`/messages/${active._id}`).then(setMessages);
    setExpandedId(null);
    socketRef.current?.emit("channel:join", active._id);

    function onNew(msg) {
      if (msg.channel === active._id) setMessages((prev) => [...prev, msg]);
    }
    function onDeleted(messageId) {
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
    }
    socketRef.current?.on("message:new", onNew);
    socketRef.current?.on("message:deleted", onDeleted);
    return () => {
      socketRef.current?.emit("channel:leave", active._id);
      socketRef.current?.off("message:new", onNew);
      socketRef.current?.off("message:deleted", onDeleted);
    };
  }, [active]);

  function send(e) {
    e.preventDefault();
    if (!text.trim() || !active?._id || !socketRef.current) return;
    socketRef.current.emit("message:send", { channelId: active._id, text });
    setText("");
  }

  async function toggleReplies(messageId) {
    if (expandedId === messageId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(messageId);
    if (!comments[messageId]) {
      const data = await apiRequest(`/comments/${messageId}`);
      setComments((prev) => ({ ...prev, [messageId]: data }));
    }
  }

  async function sendReply(e, messageId) {
    e.preventDefault();
    if (!replyText.trim()) return;
    const created = await apiRequest(`/comments/${messageId}`, { method: "POST", body: JSON.stringify({ text: replyText }) });
    setComments((prev) => ({ ...prev, [messageId]: [...(prev[messageId] || []), created] }));
    setReplyText("");
  }

  // staff moderation - remove an inappropriate post
  async function removeMessage(messageId) {
    await apiRequest(`/messages/${messageId}`, { method: "DELETE" });
    setMessages((prev) => prev.filter((m) => m._id !== messageId));
  }

  async function removeComment(messageId, commentId) {
    await apiRequest(`/comments/${commentId}`, { method: "DELETE" });
    setComments((prev) => ({ ...prev, [messageId]: prev[messageId].filter((c) => c._id !== commentId) }));
  }

  async function createChannel(e) {
    e.preventDefault();
    setMessage("");
    try {
      await apiRequest("/channels", { method: "POST", body: JSON.stringify({ name: newChannelName.trim().replace(/^#/, "") }) });
      setNewChannelName("");
      loadChannels();
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <div className="community-layout">
      <div className="channel-list">
        {channels.map((c) => (
          <div key={c._id} className={`channel-item ${active?._id === c._id ? "active" : ""}`}
            onClick={() => setActive(c)}>#{c.name}</div>
        ))}
        {isStaff && (
          <form className="new-channel-form" onSubmit={createChannel}>
            <input placeholder="new-channel" value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)} />
            <button type="submit">Add</button>
          </form>
        )}
        {message && <p className="error-text">{message}</p>}
      </div>
      <div className="channel-main">
        {!active?._id ? (
          <div className="empty-state">
            <h3>No channels yet</h3>
            <p className="muted-text">
              {isStaff
                ? "Add a channel on the left to start the conversation."
                : "Ask a staff member to create the first channel."}
            </p>
          </div>
        ) : (
        <>
        <h2>#{active.name}</h2>
        <div className="message-list">
          {messages.length === 0 && (
            <p className="muted-text">No messages in #{active.name} yet. Say hello 👋</p>
          )}
          {messages.map((m) => (
            <div className="message-block" key={m._id}>
              <div className="message-row">
                <div><strong>{m.sender?.name}</strong>: {m.text}</div>
                {isStaff && <button className="link-btn" onClick={() => removeMessage(m._id)}>Remove</button>}
              </div>
              <button className="link-btn" onClick={() => toggleReplies(m._id)}>
                {expandedId === m._id ? "Hide replies" : `Replies (${comments[m._id]?.length ?? "…"})`}
              </button>

              {expandedId === m._id && (
                <div className="reply-thread">
                  {(comments[m._id] || []).map((c) => (
                    <div className="reply-row" key={c._id}>
                      <span><strong>{c.author?.name}</strong>: {c.text}</span>
                      {(isStaff || c.author?._id === user?.id) && (
                        <button className="link-btn" onClick={() => removeComment(m._id, c._id)}>Remove</button>
                      )}
                    </div>
                  ))}
                  <form onSubmit={(e) => sendReply(e, m._id)} className="reply-form">
                    <input placeholder="Write a reply…" value={replyText} onChange={(e) => setReplyText(e.target.value)} />
                    <button type="submit">Reply</button>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>
        <form onSubmit={send}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message #${active.name}`} />
          <button type="submit">Send</button>
        </form>
        </>
        )}
      </div>
    </div>
  );
}

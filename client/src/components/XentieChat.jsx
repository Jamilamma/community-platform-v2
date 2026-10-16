import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../services/api";
import { useAuth } from "../context/AuthContext";
import "./xentie.css";

const STUDENT_ACTIONS = [
  "Find Internships",
  "Find Workshops",
  "Find Events",
  "Find Hackathons",
  "Check Applications",
  "Project Support",
];
const STAFF_ACTIONS = [
  "Pending requests",
  "My assigned requests",
  "Applications",
  "Upcoming events",
  "Upcoming hackathons",
  "Upcoming workshops",
];

const WELCOME_STUDENT =
  "Hi! I'm Xentie. I can help you find opportunities, check applications, registrations and Project Support.";
const WELCOME_STAFF =
  "Hi! I'm Xentie. I can show pending Project Support requests, requests assigned to you, applications, and upcoming events, workshops and hackathons.";

let nextId = 1;
const makeId = () => nextId++;

// **bold** support without dangerouslySetInnerHTML
function renderInline(line) {
  return line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function RichText({ text }) {
  return (
    <>
      {String(text || "")
        .split("\n")
        .map((line, i) => (
          <p key={i} className="xentie-line">
            {renderInline(line)}
          </p>
        ))}
    </>
  );
}

const SparkIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2l1.9 5.9L20 10l-6.1 2.1L12 18l-1.9-5.9L4 10l6.1-2.1z" />
    <path d="M19 15l.9 2.6L22.5 18.5l-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9z" opacity="0.75" />
  </svg>
);
const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);
const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10" />
  </svg>
);

export default function XentieChat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isStaff = user?.role === "staff";
  const actions = isStaff ? STAFF_ACTIONS : STUDENT_ACTIONS;

  const welcome = () => [
    {
      id: makeId(),
      role: "bot",
      text: isStaff ? WELCOME_STAFF : WELCOME_STUDENT,
      cards: [],
      suggestions: actions,
    },
  ];

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(welcome);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const stateRef = useRef(null); // guided-flow state echoed back to the server
  const listRef = useRef(null);
  const inputRef = useRef(null);

  // keep the newest message in view
  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, loading, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function send(rawText) {
    const text = String(rawText ?? input).trim();
    if (!text || loading) return;

    const history = messages
      .slice(-6)
      .map((m) => ({ role: m.role === "user" ? "user" : "assistant", text: m.text }));

    setMessages((prev) => [...prev, { id: makeId(), role: "user", text }]);
    setInput("");
    setLoading(true);

    try {
      const data = await apiRequest("/xentie/chat", {
        method: "POST",
        body: JSON.stringify({ message: text, state: stateRef.current, history }),
      });
      stateRef.current = data.state || null;
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: "bot",
          text: data.reply || "Sorry, I don't have an answer for that.",
          cards: Array.isArray(data.cards) ? data.cards : [],
          suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
        },
      ]);
    } catch (err) {
      const msg = String(err.message || "");
      const friendly = /token|expired|not found|unauthor/i.test(msg)
        ? "Your session has expired. Please log in again to keep chatting with me."
        : msg || "Something went wrong. Please try again.";
      setMessages((prev) => [
        ...prev,
        { id: makeId(), role: "bot", text: friendly, cards: [], suggestions: [], error: true },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }

  function reset() {
    stateRef.current = null;
    setMessages(welcome());
    setInput("");
  }

  function openCard(link) {
    if (!link) return;
    navigate(link);
    if (window.innerWidth <= 640) setOpen(false);
  }

  const lastBotId = [...messages].reverse().find((m) => m.role === "bot")?.id;

  return (
    <>
      {!open && (
        <button
          type="button"
          className="xentie-fab"
          onClick={() => setOpen(true)}
          aria-label="Open Xentie, the Community AI Assistant"
        >
          <SparkIcon />
          <span className="xentie-fab-label">Xentie</span>
        </button>
      )}

      {open && (
        <section className="xentie-panel" role="dialog" aria-label="Xentie chat">
          <header className="xentie-header">
            <div className="xentie-avatar" aria-hidden="true">
              <SparkIcon />
            </div>
            <div className="xentie-title">
              <h2>Xentie</h2>
              <span>Community AI Assistant</span>
            </div>
            <button type="button" className="xentie-icon-btn" onClick={reset} aria-label="Start a new chat" title="New chat">
              <RefreshIcon />
            </button>
            <button type="button" className="xentie-icon-btn" onClick={() => setOpen(false)} aria-label="Close chat" title="Close">
              <CloseIcon />
            </button>
          </header>

          <div className="xentie-messages" ref={listRef} aria-live="polite">
            {messages.map((m) => (
              <div key={m.id} className={`xentie-row xentie-row-${m.role}`}>
                <div className={`xentie-bubble xentie-bubble-${m.role} ${m.error ? "xentie-bubble-error" : ""}`}>
                  <RichText text={m.text} />
                </div>

                {m.cards?.length > 0 && (
                  <div className="xentie-cards">
                    {m.cards.map((c, i) => (
                      <button
                        type="button"
                        key={i}
                        className="xentie-card"
                        onClick={() => openCard(c.link)}
                        disabled={!c.link}
                      >
                        <div className="xentie-card-top">
                          <span className="xentie-card-title">{c.title}</span>
                          {c.badge && <span className="xentie-badge">{c.badge}</span>}
                        </div>
                        {c.subtitle && <div className="xentie-card-sub">{c.subtitle}</div>}
                        {(c.meta || []).map((line, j) => (
                          <div key={j} className="xentie-card-meta">
                            {line}
                          </div>
                        ))}
                      </button>
                    ))}
                  </div>
                )}

                {m.role === "bot" && m.id === lastBotId && m.suggestions?.length > 0 && (
                  <div className="xentie-chips">
                    {m.suggestions.map((s) => (
                      <button
                        type="button"
                        key={s}
                        className="xentie-chip"
                        onClick={() => send(s)}
                        disabled={loading}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="xentie-row xentie-row-bot">
                <div className="xentie-bubble xentie-bubble-bot xentie-typing" aria-label="Xentie is typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
          </div>

          <form
            className="xentie-input-bar"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              maxLength={500}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Xentie…"
              aria-label="Message Xentie"
              autoComplete="off"
            />
            <button type="submit" className="xentie-send" disabled={loading || !input.trim()} aria-label="Send message">
              <SendIcon />
            </button>
          </form>
        </section>
      )}
    </>
  );
}

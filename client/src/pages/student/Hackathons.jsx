import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

const emptyForm = {
  teamName: "",
  leaderName: "",
  leaderEmail: "",
  phone: "",
  teamMembers: "",
  college: "",
  projectTitle: "",
  projectDescription: "",
  githubLink: "",
  agreedToRules: false,
};

export default function StudentHackathons() {
  const { user } = useAuth();
  const [hackathons, setHackathons] = useState([]);
  const [myRegs, setMyRegs] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState("all");

  const [activeHackathon, setActiveHackathon] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function load() {
    apiRequest("/hackathons").then(setHackathons).catch(() => {});
    apiRequest("/hackathons/mine").then(setMyRegs).catch(() => {});
  }
  useEffect(load, []);

  const registeredIds = new Set(myRegs.map((r) => r.hackathon?._id));

  const filtered = useMemo(() => {
    return hackathons.filter((h) => {
      const matchesSearch =
        !search.trim() ||
        h.name?.toLowerCase().includes(search.toLowerCase()) ||
        h.theme?.toLowerCase().includes(search.toLowerCase());
      const matchesMode = modeFilter === "all" || h.mode === modeFilter;
      return matchesSearch && matchesMode;
    });
  }, [hackathons, search, modeFilter]);

  function openForm(hackathon) {
    setActiveHackathon(hackathon);
    setForm({
      ...emptyForm,
      leaderName: user?.name || "",
      leaderEmail: user?.email || "",
      college: user?.university || "",
    });
    setFormError("");
  }

  function closeForm() {
    setActiveHackathon(null);
    setForm(emptyForm);
    setFormError("");
  }

  async function submitRegistration(e) {
    e.preventDefault();
    if (
      !form.teamName.trim() ||
      !form.leaderName.trim() ||
      !form.leaderEmail.trim() ||
      !form.phone.trim() ||
      !form.teamMembers.trim() ||
      !form.college.trim()
    ) {
      setFormError("Please fill in all required fields.");
      return;
    }
    if (!form.agreedToRules) {
      setFormError("You must agree to the hackathon rules to register.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      await apiRequest(`/hackathons/${activeHackathon._id}/register`, {
        method: "POST",
        body: JSON.stringify(form),
      });
      setMessage("Registration confirmed!");
      closeForm();
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>Hackathons</h1>
      <p className="page-subtitle">Organized by GenAura Technologies.</p>
      {message && <p className="inline-message">{message}</p>}

      <div className="filter-bar">
        <input
          placeholder="Search by name or theme…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
          <option value="all">All modes</option>
          <option value="Online">Online</option>
          <option value="Offline">Offline</option>
          <option value="Hybrid">Hybrid</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <h3>No hackathons match your filters.</h3>
          <p>Try a different search term or mode.</p>
        </div>
      ) : (
        <div className="card-grid">
          {filtered.map((h) => {
            const isRegistered = registeredIds.has(h._id);
            return (
              <div className="opportunity-card" key={h._id}>
                {h.posterUrl && (
                  <img
                    src={h.posterUrl}
                    alt={h.name}
                    style={{ width: "100%", height: 130, objectFit: "cover", borderRadius: 10, marginBottom: 4 }}
                  />
                )}
                <div className="opportunity-card-top">
                  <span className="type-pill type-hackathon">Hackathon</span>
                  {h.mode && <span className="mode-pill">{h.mode}</span>}
                </div>
                <h3>{h.name}</h3>
                <span className="org-label">{h.orgLabel}</span>
                {h.description && <p className="opportunity-desc">{h.description}</p>}
                <div className="opportunity-meta">
                  {h.date && <span>{formatDate(h.date)}</span>}
                  {h.teamSize && <span>Team size: {h.teamSize}</span>}
                  {h.venue && <span>Venue: {h.venue}</span>}
                  {/* the join link is only shown once the student has registered */}
                  {isRegistered && /^https?:\/\//i.test(h.meetingLink || "") && (
                    <span>Online link: <a href={h.meetingLink} target="_blank" rel="noreferrer">Join</a></span>
                  )}
                  {h.registrationDeadline && <span>Deadline: {formatDate(h.registrationDeadline)}</span>}
                </div>
                <div className="opportunity-card-actions">
                  <button onClick={() => openForm(h)} disabled={isRegistered}>
                    {isRegistered ? "Registered" : "Register"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeHackathon && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h2>Register for {activeHackathon.name}</h2>
            <p className="page-subtitle" style={{ marginTop: -4, marginBottom: 4 }}>
              Fill in your team details to confirm registration.
            </p>

            <form onSubmit={submitRegistration} className="profile-form">
              <h3 className="form-section-title">Team Details</h3>

              <label>
                Team Name *
                <input
                  value={form.teamName}
                  onChange={(e) => setForm({ ...form, teamName: e.target.value })}
                  placeholder="e.g. Byte Busters"
                  required
                />
              </label>
              <label>
                Team Leader
                <input
                  value={form.leaderName}
                  onChange={(e) => setForm({ ...form, leaderName: e.target.value })}
                  required
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={form.leaderEmail}
                  onChange={(e) => setForm({ ...form, leaderEmail: e.target.value })}
                  required
                />
              </label>
              <label>
                Phone Number *
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="e.g. 9876543210"
                  required
                />
              </label>
              <label>
                Team Members (excluding leader) *
                <textarea
                  rows={2}
                  value={form.teamMembers}
                  onChange={(e) => setForm({ ...form, teamMembers: e.target.value })}
                  placeholder="e.g. Rahul, Priya, Arun"
                  required
                />
              </label>
              <label>
                College / University *
                <input
                  value={form.college}
                  onChange={(e) => setForm({ ...form, college: e.target.value })}
                  placeholder="e.g. Sathyabama Institute of Science and Technology"
                  required
                />
              </label>

              <h3 className="form-section-title">Project Details</h3>

              <label>
                Project / Idea Title
                <input
                  value={form.projectTitle}
                  onChange={(e) => setForm({ ...form, projectTitle: e.target.value })}
                  placeholder="e.g. Smart Healthcare Assistant"
                />
              </label>
              <label>
                Short Project Description
                <textarea
                  rows={3}
                  value={form.projectDescription}
                  onChange={(e) => setForm({ ...form, projectDescription: e.target.value })}
                  placeholder="Describe your idea…"
                />
              </label>
              <label>
                GitHub / Project Link (optional)
                <input
                  value={form.githubLink}
                  onChange={(e) => setForm({ ...form, githubLink: e.target.value })}
                  placeholder="https://github.com/..."
                />
              </label>

              <label className="form-checkbox-row">
                <input
                  type="checkbox"
                  checked={form.agreedToRules}
                  onChange={(e) => setForm({ ...form, agreedToRules: e.target.checked })}
                />
                <span>I agree to the hackathon rules</span>
              </label>

              {formError && <p className="error-text">{formError}</p>}

              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={closeForm}>Cancel</button>
                <button type="submit" disabled={submitting}>
                  {submitting ? "Submitting…" : "Confirm Registration"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
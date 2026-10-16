import { useEffect, useState } from "react";
import { apiRequest } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { formatDate } from "../../components/ProjectSupportShared";
import "../projectSupport.css";

const EMPTY = { name: "", email: "", password: "" };

export default function StaffAccounts() {
  const { user } = useAuth();
  const myId = user?._id || user?.id;

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  function load() {
    return apiRequest("/users/staff")
      .then((list) => { setStaff(list); setError(""); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function addStaff(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setOk("");
    try {
      const created = await apiRequest("/users/staff", { method: "POST", body: JSON.stringify(form) });
      setOk(`Staff account created for ${created.email}. Share the email and password with them.`);
      setForm(EMPTY);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(person) {
    const enable = person.isActive === false;
    const msg = enable
      ? `Enable ${person.email}? They will be able to log in again.`
      : `Disable ${person.email}? They will be logged out and cannot log in. Their data is kept.`;
    if (!window.confirm(msg)) return;
    setError("");
    setOk("");
    try {
      await apiRequest(`/users/staff/${person._id}/active`, { method: "PATCH", body: JSON.stringify({ active: enable }) });
      setOk(`${person.email} ${enable ? "enabled" : "disabled"}.`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function resetPassword(person) {
    const password = window.prompt(`New password for ${person.email} (minimum 8 characters):`);
    if (!password) return;
    setError("");
    setOk("");
    try {
      await apiRequest(`/users/staff/${person._id}/password`, { method: "PATCH", body: JSON.stringify({ password }) });
      setOk(`Password updated for ${person.email}.`);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!user?.isOwner) {
    return (
      <div>
        <h1>Staff Accounts</h1>
        <p className="error-text">Only the owner can manage staff accounts.</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Staff Accounts</h1>
      <p className="page-subtitle">Only you (the owner) can see this page. Add team members, reset passwords, or disable people who leave.</p>

      {error && <p className="error-text">{error}</p>}
      {ok && <p className="ps-note-ok">{ok}</p>}

      <form className="ps-card ps-form" onSubmit={addStaff}>
        <label>
          Full name
          <input value={form.name} onChange={set("name")} required placeholder="e.g. Priya Sharma" />
        </label>
        <label>
          Email
          <input type="email" value={form.email} onChange={set("email")} required placeholder="name@yourcompany.com" />
        </label>
        <label>
          Password (min 8 characters)
          <input type="text" value={form.password} onChange={set("password")} required minLength={8} placeholder="Temporary password" autoComplete="off" />
        </label>
        <div className="ps-full">
          <button type="submit" disabled={saving}>{saving ? "Creating…" : "Add Staff"}</button>
        </div>
      </form>

      <h3 style={{ marginTop: 24 }}>Current staff ({staff.length})</h3>
      {loading ? (
        <p className="muted-text">Loading…</p>
      ) : (
        <div className="ps-table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Added</th><th></th></tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s._id}>
                  <td><strong>{s.name}</strong>{s._id === myId && <small> (you)</small>}</td>
                  <td>{s.email}</td>
                  <td>{s.isOwner ? "Owner" : "Staff"}</td>
                  <td>
                    <span className={`status-pill ${s.isActive === false ? "status-rejected" : "status-selected"}`}>
                      {s.isActive === false ? "Disabled" : "Active"}
                    </span>
                  </td>
                  <td>{formatDate(s.createdAt)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="link-btn" onClick={() => resetPassword(s)}>Reset password</button>
                    {!s.isOwner && s._id !== myId && (
                      <>
                        {" · "}
                        <button className="link-btn" onClick={() => toggleActive(s)}>
                          {s.isActive === false ? "Enable" : "Disable"}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
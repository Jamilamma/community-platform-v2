import { useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../../services/api";

// Students only. Step 1: name + email. We email a verification link; the student
// creates their password after clicking it. Backend always assigns the "student" role.
export default function Register() {
  const [form, setForm] = useState({ name: "", email: "" });
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiRequest("/auth/register", { method: "POST", body: JSON.stringify(form) });
      setSentTo(form.email);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (sentTo) {
    return (
      <div className="auth-page">
        <h1>Check your email</h1>
        <p>
          We sent a verification link to <strong>{sentTo}</strong>. Click it to verify your email and create your
          password. The link is valid for 24 hours.
        </p>
        <p>Did not get it? Check your spam folder, or <Link to="/forgot-password">send a new link</Link>.</p>
        <p><Link to="/login">Back to login</Link></p>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <h1>Student Registration</h1>
      <form onSubmit={handleSubmit}>
        <input placeholder="Full name" value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input type="email" placeholder="Email" value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        {error && <p className="error-text">{error}</p>}
        <button type="submit" disabled={loading}>{loading ? "Sending…" : "Register"}</button>
      </form>
      <p>You will create your password after verifying your email.</p>
      <p>Already have an account? <Link to="/login">Login</Link></p>
    </div>
  );
}
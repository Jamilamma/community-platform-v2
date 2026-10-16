import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { apiRequest } from "../../services/api";

// Opened from the email link:  /set-password?mode=verify|reset&token=...
//   verify -> first password after email verification
//   reset  -> new password after "Forgot password"
export default function SetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const isVerify = params.get("mode") === "verify";
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Password must be at least 8 characters");
    if (password !== confirm) return setError("Passwords do not match");
    setLoading(true);
    try {
      const data = await apiRequest("/auth/set-password", { method: "POST", body: JSON.stringify({ token, password }) });
      navigate("/login", { state: { message: data.message } });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="auth-page">
        <h1>Invalid link</h1>
        <p>This link is missing its token. Please use the link from your email, or request a new one.</p>
        <p><Link to="/forgot-password">Send a new link</Link></p>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <h1>{isVerify ? "Create your password" : "Set a new password"}</h1>
      <p>{isVerify ? "Your email is verified once you save a password." : "Choose a new password for your account."}</p>
      <form onSubmit={handleSubmit}>
        <input type="password" placeholder="New password (min 8 characters)" value={password}
          onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
        <input type="password" placeholder="Confirm password" value={confirm}
          onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
        {error && <p className="error-text">{error}</p>}
        <button type="submit" disabled={loading}>{loading ? "Saving…" : "Save password"}</button>
      </form>
      <p>Link expired? <Link to="/forgot-password">Get a new one</Link></p>
    </div>
  );
}
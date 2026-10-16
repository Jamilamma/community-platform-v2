import { useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../../services/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiRequest("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
      setDone(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <h1>Forgot password</h1>
      {done ? (
        <p>{done}</p>
      ) : (
        <>
          <p>Enter your email and we will send you a link to set a new password.</p>
          <form onSubmit={handleSubmit}>
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            {error && <p className="error-text">{error}</p>}
            <button type="submit" disabled={loading}>{loading ? "Sending…" : "Send reset link"}</button>
          </form>
        </>
      )}
      <p><Link to="/login">Back to login</Link></p>
    </div>
  );
}
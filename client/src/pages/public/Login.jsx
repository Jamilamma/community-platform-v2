import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { apiRequest } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const notice = location.state?.message; // e.g. "Password updated. You can log in now."

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const data = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      login(data.token, data.user);
      navigate(data.user.role === "staff" ? "/staff" : "/student");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="auth-page">
      <h1>Login</h1>
      {notice && (
        <p style={{ background: "#e7f8f1", color: "#0a7d55", padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>
          {notice}
        </p>
      )}
      <form onSubmit={handleSubmit}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="error-text">{error}</p>}
        <button type="submit">Login</button>
      </form>
      <p><Link to="/forgot-password">Forgot password?</Link></p>
      <p>New student? <Link to="/register">Register here</Link></p>
    </div>
  );
}
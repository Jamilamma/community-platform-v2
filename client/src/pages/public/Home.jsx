import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="home-page">
      <h1>Community & Opportunities</h1>
      <p>Internships, workshops and training from Xentwin Technologies, plus events, hackathons and competitions from GenAura Technologies — all in one workspace.</p>
      <div className="home-actions">
        <Link to="/register">Get started</Link>
        <Link to="/login">Log in</Link>
      </div>
    </div>
  );
}
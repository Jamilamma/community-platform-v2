import { useEffect, useState } from "react";
import { apiRequest } from "../../services/api";

// A simple horizontal bar row — no charting library, just a styled div,
// per the "keep analytics simple and readable" requirement.
function BarRow({ label, count, max }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="bar-row">
      <span className="bar-row-label">{label}</span>
      <div className="bar-row-track">
        <div className="bar-row-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="bar-row-count">{count}</span>
    </div>
  );
}

export default function StaffAnalytics() {
  const [data, setData] = useState(null);

  useEffect(() => {
    apiRequest("/analytics/staff").then(setData).catch(() => {});
  }, []);

  if (!data) return <div><h1>Analytics</h1><p>Loading…</p></div>;

  const monthMax = Math.max(1, ...data.applicationsByMonth.map((m) => m.count));
  const statusMax = Math.max(1, ...data.statusBreakdown.map((s) => s.count));
  const popularMax = Math.max(1, ...data.popularOpportunities.map((p) => p.count));
  const typeMax = Math.max(1, ...data.registrationsByType.map((t) => t.count));

  return (
    <div>
      <h1>Analytics</h1>
      <p className="page-subtitle">A simple overview of platform activity.</p>

      <div className="analytics-grid">
        <section className="panel">
          <h2>Applications by Month</h2>
          {data.applicationsByMonth.map((m) => (
            <BarRow key={m.label} label={m.label} count={m.count} max={monthMax} />
          ))}
        </section>

        <section className="panel">
          <h2>Application Status Breakdown</h2>
          {data.statusBreakdown.map((s) => (
            <BarRow key={s.status} label={s.status} count={s.count} max={statusMax} />
          ))}
        </section>

        <section className="panel">
          <h2>Popular Opportunities</h2>
          {data.popularOpportunities.length === 0 ? (
            <p className="muted-text">No applications yet.</p>
          ) : (
            data.popularOpportunities.map((p) => (
              <BarRow key={p.title} label={p.title} count={p.count} max={popularMax} />
            ))
          )}
        </section>

        <section className="panel">
          <h2>Registrations by Opportunity Type</h2>
          {data.registrationsByType.map((t) => (
            <BarRow key={t.type} label={t.type} count={t.count} max={typeMax} />
          ))}
        </section>

        <section className="panel">
          <h2>Organization Activity</h2>
          {data.organizationActivity.map((o) => (
            <div key={o.organization} className="org-activity-card">
              <strong>{o.organization}</strong>
              <span>{o.opportunities} opportunities · {o.engagement} applications/registrations</span>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

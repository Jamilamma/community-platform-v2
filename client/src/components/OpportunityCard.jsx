const TYPE_LABEL = {
  internship: "Internship",
  workshop: "Workshop",
  event: "Event",
  hackathon: "Hackathon",
};

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// Reusable card used on the unified Opportunities page and on each
// individual Workshops/Events/Hackathons/Internships page.
export default function OpportunityCard({ item, actionLabel, onAction, actionDisabled, secondaryLink }) {
  return (
    <div className="opportunity-card">
      {item.posterUrl && (
        <img
          src={item.posterUrl}
          alt={item.title}
          style={{ width: "100%", height: 130, objectFit: "cover", borderRadius: 10, marginBottom: 4 }}
        />
      )}
      <div className="opportunity-card-top">
        <span className={`type-pill type-${item.type}`}>{TYPE_LABEL[item.type] || item.type}</span>
        {item.mode && <span className="mode-pill">{item.mode}</span>}
      </div>
      <h3>{item.title}</h3>
      <span className="org-label">{item.orgLabel}</span>
      {item.description && <p className="opportunity-desc">{item.description}</p>}

      {item.skills && item.skills.length > 0 && (
        <div className="skill-tags">
          {item.skills.slice(0, 4).map((s) => (
            <span key={s} className="skill-tag">{s}</span>
          ))}
        </div>
      )}

      <div className="opportunity-meta">
        {item.date && <span>{formatDate(item.date)}</span>}
        {item.location && <span>{item.location}</span>}
        {item.deadline && <span>Deadline: {formatDate(item.deadline)}</span>}
      </div>

      <div className="opportunity-card-actions">
        {secondaryLink}
        {onAction && (
          <button onClick={onAction} disabled={actionDisabled}>
            {actionDisabled ? "Registered" : actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
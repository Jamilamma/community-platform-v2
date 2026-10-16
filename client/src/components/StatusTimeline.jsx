const REJECT_BRANCH = ["Applied", "Under Review", "Shortlisted", "Rejected"];
const SELECT_BRANCH = ["Applied", "Under Review", "Shortlisted", "Selected"];

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// Renders the Applied -> Under Review -> Shortlisted -> Selected/Rejected
// timeline for a single application. The backend only stores the current
// status (not a full history log), so completed steps use the applied
// date, the current step uses the last-updated date, and later steps show
// "Pending".
export default function StatusTimeline({ application }) {
  const steps = application.status === "Rejected" ? REJECT_BRANCH : SELECT_BRANCH;
  const currentIndex = steps.indexOf(application.status);
  const effectiveIndex = currentIndex === -1 ? 0 : currentIndex;

  return (
    <div className="status-timeline">
      {steps.map((step, i) => {
        let symbol = "○";
        let dateLabel = "Pending";
        if (i < effectiveIndex) {
          symbol = "✓";
          dateLabel = formatDate(application.createdAt);
        } else if (i === effectiveIndex) {
          symbol = step === "Rejected" ? "✕" : "●";
          dateLabel = formatDate(application.updatedAt);
        }
        return (
          <div className={`timeline-step ${i <= effectiveIndex ? "timeline-step-done" : ""}`} key={step}>
            <span className="timeline-symbol">{symbol}</span>
            <span className="timeline-label">{step}</span>
            <span className="timeline-date">{dateLabel}</span>
          </div>
        );
      })}
    </div>
  );
}

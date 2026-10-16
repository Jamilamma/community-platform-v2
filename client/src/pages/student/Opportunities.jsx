import { useEffect, useState } from "react";
import { apiRequest } from "../../services/api";
import OpportunityCard from "../../components/OpportunityCard";

const TYPES = [
  { value: "all", label: "All" },
  { value: "internship", label: "Internships" },
  { value: "workshop", label: "Workshops" },
  { value: "event", label: "Events" },
  { value: "hackathon", label: "Hackathons" },
];

const ORGS = [
  { value: "all", label: "All" },
  { value: "Xentwin Technologies", label: "Xentwin Technologies" },
  { value: "GenAura Technologies", label: "GenAura Technologies" },
];

const REGISTER_ENDPOINT = {
  internship: (id) => `/internships/${id}/apply`,
  workshop: (id) => `/workshops/${id}/register`,
  event: (id) => `/events/${id}/register`,
  hackathon: (id) => `/hackathons/${id}/register`,
};

const ACTION_LABEL = {
  internship: "Apply",
  workshop: "Register",
  event: "Register",
  hackathon: "Register",
};

export default function Opportunities() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [organization, setOrganization] = useState("all");
  const [message, setMessage] = useState("");
  const [doneIds, setDoneIds] = useState(new Set());

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (type !== "all") params.set("type", type);
    if (organization !== "all") params.set("organization", organization);

    apiRequest(`/opportunities?${params.toString()}`)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }

  useEffect(load, [type, organization]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    load();
  }

  function handleTypeChange(value) {
    setType(value);
    if (value === "internship" || value === "workshop") setOrganization((org) => (org === "GenAura Technologies" ? "all" : org));
    if (value === "event" || value === "hackathon") setOrganization((org) => (org === "Xentwin Technologies" ? "all" : org));
  }

  async function act(item) {
    setMessage("");
    try {
      await apiRequest(REGISTER_ENDPOINT[item.type](item.id), { method: "POST" });
      setDoneIds((prev) => new Set(prev).add(item.id));
      setMessage(item.type === "internship" ? "Application submitted!" : "Registration confirmed!");
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <div>
      <h1>Opportunities</h1>
      <p className="page-subtitle">Browse internships, workshops, events and hackathons in one place.</p>

      <form className="filter-bar" onSubmit={handleSearchSubmit}>
        <input
          placeholder="Search by title, skill or keyword"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={type} onChange={(e) => handleTypeChange(e.target.value)}>
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={organization} onChange={(e) => setOrganization(e.target.value)}>
          {ORGS.filter((o) =>
            o.value === "all" ||
            type === "all" ||
            (type === "internship" && o.value === "Xentwin Technologies") ||
            (type === "workshop" && o.value === "Xentwin Technologies") ||
            (type === "event" && o.value === "GenAura Technologies") ||
            (type === "hackathon" && o.value === "GenAura Technologies")
          ).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button type="submit">Search</button>
      </form>

      {message && <p className="inline-message">{message}</p>}

      {loading ? (
        <p>Loading opportunities…</p>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <h3>No opportunities found.</h3>
          <p>Try a different search term or clear your filters.</p>
        </div>
      ) : (
        <div className="card-grid">
          {items.map((item) => (
            <OpportunityCard
              key={`${item.type}-${item.id}`}
              item={item}
              actionLabel={ACTION_LABEL[item.type]}
              actionDisabled={doneIds.has(item.id)}
              onAction={() => act(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
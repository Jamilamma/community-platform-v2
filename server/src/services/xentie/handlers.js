// Xentie — data handlers. Every query that touches private data is filtered by the
// logged-in user (students: their own id; staff: only what the staff API already allows).

const { supabase } = require("../../utils/db");
const { dayStart, fmtDate, clip, plural, firstName, keywords: extractKeywords } = require("./utils");

const MAX_CARDS = 6;

// ---------------------------------------------------------------- small helpers

async function run(q) {
  const r = await q;
  if (r.error) {
    const e = new Error(r.error.message);
    e.code = r.error.code;
    throw e;
  }
  return r;
}

const base = (user) => (user.role === "staff" ? "/staff" : "/student");
const lower = (v) => String(v || "").toLowerCase();
const countBy = (rows, fn) =>
  rows.reduce((acc, r) => {
    const k = fn(r);
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
const countLine = (counts) =>
  Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(", ");

function strip(words, extra) {
  const drop = new Set(extra);
  return words.filter((w) => !drop.has(w));
}

// ---------------------------------------------------------------- opportunities

const TYPES = {
  internship: { table: "internships", label: "internship", path: "internships", org: "Xentwin Technologies" },
  workshop: { table: "workshops", label: "workshop", path: "workshops", org: "Xentwin Technologies" },
  event: { table: "events", label: "event", path: "events", org: "GenAura Technologies" },
  hackathon: { table: "hackathons", label: "hackathon", path: "hackathons", org: "GenAura Technologies" },
};

function normalizeOpp(row, type) {
  const meta = TYPES[type];
  const title = type === "hackathon" ? row.name : row.title;
  const skills = row.required_skills || [];
  return {
    id: row.id,
    type,
    title,
    orgLabel: row.org_label || meta.org,
    org: row.organization || meta.org,
    mode: row.mode || null,
    date: type === "internship" ? null : row.date,
    deadline: type === "internship" ? row.deadline : row.registration_deadline,
    skills,
    row,
    hay: lower([title, row.description, row.theme, row.location, row.venue, row.instructor, ...skills].filter(Boolean).join(" | ")),
  };
}

// open = still possible to apply / attend
async function fetchOpportunities(types, now = new Date()) {
  const nowIso = now.toISOString();
  const todayIso = new Date(dayStart(now)).toISOString();
  const jobs = types.map(async (type) => {
    const meta = TYPES[type];
    let q = supabase.from(meta.table).select("*").limit(300);
    q = type === "internship" ? q.gte("deadline", nowIso).order("deadline") : q.gte("date", todayIso).order("date");
    const { data } = await run(q);
    return (data || []).map((r) => normalizeOpp(r, type));
  });
  return (await Promise.all(jobs)).flat();
}

const MODE_MATCH = {
  remote: ["remote", "online"],
  onsite: ["on-site", "offline", "onsite"],
  hybrid: ["hybrid"],
};

const SYNONYMS = {
  ai: ["ai", "artificial intelligence", "machine learning", "ml", "genai", "deep learning", "llm"],
  ml: ["ml", "machine learning", "ai", "deep learning"],
  web: ["web", "frontend", "front-end", "backend", "back-end", "react", "javascript", "html", "css", "node", "full stack", "fullstack"],
  data: ["data", "analytics", "analysis", "sql", "pandas", "power bi", "tableau"],
  app: ["app", "android", "ios", "flutter", "react native", "mobile"],
  mobile: ["mobile", "android", "ios", "flutter", "react native", "app"],
  cyber: ["cyber", "security", "hacking", "pentest", "infosec"],
  security: ["security", "cyber", "pentest", "infosec"],
  cloud: ["cloud", "aws", "azure", "gcp", "devops"],
  devops: ["devops", "docker", "kubernetes", "ci/cd", "cloud"],
  iot: ["iot", "embedded", "arduino", "sensor", "raspberry"],
  design: ["design", "ui", "ux", "figma"],
  blockchain: ["blockchain", "web3", "crypto", "solidity"],
};

function termMatches(hay, term) {
  const variants = SYNONYMS[term] || [term];
  return variants.some((v) =>
    v.length <= 3 ? new RegExp(`(^|[^a-z0-9])${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(hay) : hay.includes(v)
  );
}

function sortByWhen(a, b) {
  const da = new Date(a.date || a.deadline || 0).getTime();
  const db = new Date(b.date || b.deadline || 0).getTime();
  return da - db;
}

function oppCard(o, user) {
  const r = o.row;
  const meta = [];
  if (o.type === "internship") {
    if (o.deadline) meta.push(`Apply by ${fmtDate(o.deadline)}`);
    if (r.duration) meta.push(r.duration);
  } else {
    if (o.date) meta.push(`${fmtDate(o.date)}${r.time ? ` · ${r.time}` : ""}`);
    if (o.type === "workshop" && r.instructor) meta.push(`By ${r.instructor}`);
    if (o.type === "hackathon" && r.theme) meta.push(`Theme: ${r.theme}`);
    if (o.type === "hackathon" && r.team_size) meta.push(`Team size: ${r.team_size}`);
  }
  const where = [o.mode, r.location || r.venue].filter(Boolean).join(" · ");
  if (where) meta.push(where);
  if (o.skills.length) meta.push(`Skills: ${o.skills.slice(0, 4).join(", ")}`);

  const closed = o.type !== "internship" && o.deadline && new Date(o.deadline) < new Date();
  return {
    kind: "opportunity",
    title: o.title,
    subtitle: o.orgLabel,
    badge: closed ? "Registration closed" : TYPES[o.type].label[0].toUpperCase() + TYPES[o.type].label.slice(1),
    meta,
    link: `${base(user)}/${TYPES[o.type].path}`,
  };
}

function typeWords(types, n = 2) {
  if (!types.length || types.length > 1) return n === 1 ? "opportunity" : "opportunities";
  return TYPES[types[0]].label + (n === 1 ? "" : "s");
}

function orgText(types) {
  const orgs = [...new Set((types.length ? types : Object.keys(TYPES)).map((t) => TYPES[t].org))];
  return orgs.map((o) => `**${o}**`).join(" and ");
}

async function findOpportunity({ user, params }) {
  const types = params.types.length ? params.types : Object.keys(TYPES);
  let items = await fetchOpportunities(types);

  if (params.mode) {
    const accepted = MODE_MATCH[params.mode];
    items = items.filter((o) => o.mode && accepted.includes(lower(o.mode)));
  }
  if (params.timeframe) {
    const { from, to } = params.timeframe;
    items = items.filter((o) => {
      const when = new Date(o.date || o.deadline || 0).getTime();
      return when >= from && (to == null || when <= to);
    });
  }

  const terms = [...new Set(params.keywords)].slice(0, 6);
  if (terms.length) {
    items = items
      .map((o) => ({ o, score: terms.filter((t) => termMatches(o.hay, t)).length }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || sortByWhen(a.o, b.o))
      .map((x) => x.o);
  } else {
    items.sort(sortByWhen);
  }

  const filterBits = [];
  if (terms.length) filterBits.push(`“${terms.join(" ")}”`);
  if (params.mode) filterBits.push(params.mode === "onsite" ? "on-site" : params.mode);
  if (params.timeframe) filterBits.push(params.timeframe.label);
  const filterText = filterBits.length ? ` (${filterBits.join(", ")})` : "";

  if (!items.length) {
    return {
      reply: `I couldn't find any open ${typeWords(params.types)} matching your search${filterText}. Try fewer filters, or ask me for everything that's open right now.`,
      suggestions: ["Show all opportunities", "Recommend for me", "Find Hackathons"],
    };
  }

  const shown = items.slice(0, MAX_CARDS);
  const lead = `I found **${items.length}** open ${typeWords(params.types, items.length)} from ${orgText(params.types.length ? params.types : [...new Set(items.map((i) => i.type))])}${filterText}.`;
  const tail = items.length > shown.length
    ? ` Here are the first ${shown.length} — open the page for the full list.`
    : items.length === 1 ? " Here it is:" : " Here they are:";
  const hint = !terms.length && !params.mode && !params.timeframe
    ? "\nTip: add a skill, mode or date — for example “remote AI internships” or “hackathons this month”."
    : "";

  return {
    reply: lead + tail + hint,
    cards: shown.map((o) => oppCard(o, user)),
    suggestions: user.role === "student" ? ["Recommend for me", "Check my applications"] : ["Pending requests", "Applications"],
  };
}

// ---------------------------------------------------------------- recommendations (student)

async function recommend({ user, params }) {
  if (user.role !== "student") {
    return {
      reply: "Personalised recommendations are built from a student's profile. As staff you can ask me for pending Project Support requests, applications, or upcoming events, workshops and hackathons.",
      suggestions: ["Pending requests", "Applications", "Upcoming events"],
    };
  }

  const types = params.types.length ? params.types : Object.keys(TYPES);
  const now = new Date();
  const [all, applied, ws, ev, hk] = await Promise.all([
    fetchOpportunities(types, now),
    run(supabase.from("applications").select("internship_id").eq("student_id", user._id)),
    run(supabase.from("workshop_registrations").select("workshop_id").eq("student_id", user._id)),
    run(supabase.from("event_registrations").select("event_id").eq("student_id", user._id)),
    run(supabase.from("hackathon_registrations").select("hackathon_id").eq("student_id", user._id)),
  ]);

  const done = new Set([
    ...(applied.data || []).map((r) => r.internship_id),
    ...(ws.data || []).map((r) => r.workshop_id),
    ...(ev.data || []).map((r) => r.event_id),
    ...(hk.data || []).map((r) => r.hackathon_id),
  ]);

  // still possible to join: registration / application deadline not passed, not already joined
  const open = all.filter((o) => !done.has(o.id) && (!o.deadline || new Date(o.deadline) >= now));

  const skills = (user.skills || []).map(lower).filter(Boolean);
  const courseTerms = extractKeywords(user.course || "").filter((w) => w.length > 2);
  const hasProfile = skills.length > 0 || courseTerms.length > 0;

  const scored = open.map((o) => {
    let score = 0;
    const matched = [];
    for (const s of skills) {
      if (o.skills.map(lower).includes(s)) { score += 4; matched.push(s); }
      else if (termMatches(lower(o.title), s)) { score += 3; matched.push(s); }
      else if (termMatches(o.hay, s)) { score += 1; matched.push(s); }
    }
    let courseHit = false;
    for (const c of courseTerms) {
      if (termMatches(o.hay, c)) { score += 1; courseHit = true; }
    }
    return { o, score, matched: [...new Set(matched)], courseHit };
  });

  const ranked = scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score || sortByWhen(a.o, b.o));
  const fallbackUsed = ranked.length === 0;
  const picks = (fallbackUsed ? scored.sort((a, b) => sortByWhen(a.o, b.o)) : ranked).slice(0, MAX_CARDS);

  if (!picks.length) {
    return {
      reply: "I don't see any open opportunities that you haven't already applied to or registered for right now. Check back soon — new ones are added regularly.",
      suggestions: ["Check my applications", "Show my registrations"],
    };
  }

  const cards = picks.map((p) => {
    const card = oppCard(p.o, user);
    const why = p.matched.length
      ? `Matches your skills: ${p.matched.slice(0, 4).join(", ")}`
      : p.courseHit
        ? `Related to your course${user.course ? ` (${user.course})` : ""}`
        : "Coming up soon";
    card.meta = [why, ...card.meta];
    return card;
  });

  let reply;
  if (!hasProfile) {
    reply = "Your profile doesn't list any skills or a course yet, so I can't personalise this. Add your skills in **Profile** for sharper matches. Meanwhile, here is what's coming up soon:";
  } else if (fallbackUsed) {
    reply = "I couldn't find a strong match for your current skills, so here is what's coming up soon. Adding more skills in **Profile** will improve my suggestions:";
  } else {
    reply = `Based on your profile${skills.length ? ` (${skills.slice(0, 4).join(", ")})` : ""}, here are my top picks for you — I left out anything you've already applied to or registered for:`;
  }

  return {
    reply,
    cards,
    suggestions: ["Find Internships", "Find Hackathons", "Check my applications"],
  };
}

// ---------------------------------------------------------------- applications

const APP_STATUS_HELP = {
  Applied: "Your application is submitted and waiting to be picked up.",
  "Under Review": "The Xentwin Technologies team is reviewing your profile and resume.",
  Shortlisted: "You passed the first screening. Keep an eye on Notifications for the next steps.",
  Selected: "Congratulations — you've been selected!",
  Rejected: "You weren't selected this time. You can apply to other open internships.",
};
const APP_STATUS_ORDER = ["Selected", "Shortlisted", "Under Review", "Applied", "Rejected"];
const APP_NOISE = [
  "shortlisted", "shortlist", "selected", "rejected", "review", "reviewing", "accepted", "declined",
  "rejection", "selection", "offer", "offered", "anywhere", "anything", "applicants", "applicant", "someone",
];

async function applications(ctx) {
  return ctx.user.role === "staff" ? staffApplications(ctx) : studentApplications(ctx);
}

async function studentApplications({ user, params }) {
  const { data } = await run(
    supabase
      .from("applications")
      .select("id, status, created_at, internship:internships!internship_id(id, title, org_label, deadline)")
      .eq("student_id", user._id)
      .order("created_at", { ascending: false })
      .limit(100)
  );
  const all = data || [];

  if (!all.length) {
    return {
      reply: "You haven't applied to any internships yet. Want me to find some that suit you?",
      suggestions: ["Find Internships", "Recommend for me"],
    };
  }

  const terms = strip(params.keywords || [], APP_NOISE);
  let rows = all;
  if (params.status) rows = rows.filter((a) => a.status === params.status);
  if (terms.length) rows = rows.filter((a) => terms.some((t) => lower(a.internship?.title).includes(t)));

  if (!rows.length) {
    const what = [params.status && params.status.toLowerCase(), terms.length && `matching “${terms.join(" ")}”`].filter(Boolean).join(" ");
    return {
      reply: `You don't have any ${what} applications. You have **${all.length}** application${all.length === 1 ? "" : "s"} in total: ${countLine(countBy(all, (a) => a.status))}.`,
      suggestions: ["Check my applications", "Find Internships"],
    };
  }

  const counts = countBy(rows, (a) => a.status);
  const sorted = [...rows].sort(
    (a, b) => APP_STATUS_ORDER.indexOf(a.status) - APP_STATUS_ORDER.indexOf(b.status) || new Date(b.created_at) - new Date(a.created_at)
  );

  let reply = params.status
    ? `You have **${rows.length}** ${params.status.toLowerCase()} application${rows.length === 1 ? "" : "s"}.`
    : `You have **${rows.length}** application${rows.length === 1 ? "" : "s"}: ${countLine(counts)}.`;
  if (params.status) reply += ` ${APP_STATUS_HELP[params.status]}`;
  else if (rows.length === 1) reply += ` ${APP_STATUS_HELP[rows[0].status]}`;
  if (rows.length > MAX_CARDS) reply += ` Showing the first ${MAX_CARDS}.`;

  return {
    reply,
    cards: sorted.slice(0, MAX_CARDS).map((a) => ({
      kind: "application",
      title: a.internship?.title || "Internship",
      subtitle: a.internship?.org_label || "Xentwin Technologies",
      badge: a.status,
      meta: [`Applied on ${fmtDate(a.created_at)}`, APP_STATUS_HELP[a.status]],
      link: "/student/applications",
    })),
    suggestions: ["What do the statuses mean?", "Find Internships"],
  };
}

async function appStatusExplain({ params }) {
  if (params.status) {
    return { reply: `**${params.status}** — ${APP_STATUS_HELP[params.status]}`, suggestions: ["Check my applications"], noAI: true };
  }
  return {
    reply: [
      "Here is what each application status means:",
      ...APP_STATUS_ORDER.slice().reverse().filter((s) => s !== "Rejected").map((s) => `**${s}** — ${APP_STATUS_HELP[s]}`),
      `**Rejected** — ${APP_STATUS_HELP.Rejected}`,
    ].join("\n"),
    suggestions: ["Check my applications"],
    noAI: true,
  };
}

async function staffApplications({ user, params }) {
  const { data } = await run(
    supabase
      .from("applications")
      .select("id, status, created_at, student:users!student_id(name, university, course), internship:internships!internship_id(id, title)")
      .order("created_at", { ascending: false })
      .limit(500)
  );
  let rows = data || [];
  if (!rows.length) {
    return { reply: "There are no internship applications yet.", suggestions: ["Pending requests", "Upcoming events"] };
  }

  const terms = strip(params.keywords || [], APP_NOISE);
  if (params.status) rows = rows.filter((a) => a.status === params.status);
  if (terms.length) {
    rows = rows.filter((a) => terms.some((t) => lower(a.internship?.title).includes(t) || lower(a.student?.name).includes(t)));
  }
  if (!rows.length) {
    return {
      reply: "No applications match that search. Try a different internship title, student name or status.",
      suggestions: ["Applications", "Pending requests"],
    };
  }

  const byStatus = countBy(rows, (a) => a.status);
  const byInternship = Object.entries(countBy(rows, (a) => a.internship?.title || "Internship"))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t, n]) => `${t} (${n})`);

  let reply = `There ${rows.length === 1 ? "is" : "are"} **${rows.length}** application${rows.length === 1 ? "" : "s"}${params.status ? ` with status ${params.status}` : `: ${countLine(byStatus)}`}.`;
  if (byInternship.length > 1) reply += ` Most applied: ${byInternship.join(", ")}.`;
  reply += " Here are the most recent — you can review and update statuses on the Applications page.";

  return {
    reply,
    cards: rows.slice(0, MAX_CARDS).map((a) => ({
      kind: "application",
      title: `${a.student?.name || "Student"} → ${a.internship?.title || "Internship"}`,
      subtitle: [a.student?.university, a.student?.course].filter(Boolean).join(" · ") || "Xentwin Technologies internship",
      badge: a.status,
      meta: [`Applied on ${fmtDate(a.created_at)}`],
      link: `${base(user)}/applications`,
    })),
    suggestions: ["Shortlisted applications", "Pending requests"],
  };
}

// ---------------------------------------------------------------- registrations (student)

async function registrations({ user, params }) {
  if (user.role === "staff") {
    return {
      reply: "Registration lists for each workshop, event and hackathon are on their own pages — open one to see who registered.",
      cards: [
        { kind: "channel", title: "Workshops", subtitle: "Xentwin Technologies", meta: [], link: "/staff/workshops" },
        { kind: "channel", title: "Events", subtitle: "GenAura Technologies", meta: [], link: "/staff/events" },
        { kind: "channel", title: "Hackathons", subtitle: "GenAura Technologies", meta: [], link: "/staff/hackathons" },
      ],
      noAI: true,
    };
  }

  const want = (params.types || []).filter((t) => t !== "internship");
  const types = want.length ? want : ["workshop", "event", "hackathon"];
  const SEL = {
    workshop: ["workshop_registrations", "workshop:workshops!workshop_id(id, title, org_label, date, time, mode)", "workshop"],
    event: ["event_registrations", "event:events!event_id(id, title, org_label, date, time, mode, location)", "event"],
    hackathon: ["hackathon_registrations", "hackathon:hackathons!hackathon_id(id, name, org_label, date, mode, venue, team_size)", "hackathon"],
  };

  const results = await Promise.all(
    types.map(async (type) => {
      const [table, embed, key] = SEL[type];
      const select = type === "hackathon" ? `team_name, created_at, ${embed}` : `created_at, ${embed}`;
      const { data } = await run(supabase.from(table).select(select).eq("student_id", user._id).limit(100));
      return (data || []).map((r) => {
        const o = r[key] || {};
        return {
          type,
          title: type === "hackathon" ? o.name : o.title,
          orgLabel: o.org_label,
          date: o.date,
          time: o.time,
          mode: o.mode,
          where: o.location || o.venue,
          team: r.team_name,
        };
      });
    })
  );

  const today = dayStart(new Date());
  let rows = results.flat().filter((r) => r.title);
  if (params.upcomingOnly) rows = rows.filter((r) => r.date && new Date(r.date).getTime() >= today);

  if (!rows.length) {
    return {
      reply: params.upcomingOnly
        ? "You don't have any upcoming registrations. Want me to find something to join?"
        : `You haven't registered for any ${want.length === 1 ? plural(2, want[0]).replace("2 ", "") : "workshops, events or hackathons"} yet.`,
      suggestions: ["Find Workshops", "Find Events", "Find Hackathons"],
    };
  }

  const isUpcoming = (r) => r.date && new Date(r.date).getTime() >= today;
  const upcoming = rows.filter(isUpcoming).sort((a, b) => new Date(a.date) - new Date(b.date));
  const past = rows.filter((r) => !isUpcoming(r)).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  const ordered = [...upcoming, ...past];

  let reply = `You have **${rows.length}** registration${rows.length === 1 ? "" : "s"}: ${countLine(countBy(rows, (r) => TYPES[r.type].label + (countBy(rows, (x) => x.type)[r.type] === 1 ? "" : "s")))}.`;
  if (upcoming.length) reply += ` Next up: **${upcoming[0].title}** on ${fmtDate(upcoming[0].date)}.`;
  else reply += " None of them are upcoming.";
  if (ordered.length > MAX_CARDS) reply += ` Showing the first ${MAX_CARDS}.`;

  return {
    reply,
    cards: ordered.slice(0, MAX_CARDS).map((r) => ({
      kind: "registration",
      title: r.title,
      subtitle: r.orgLabel || TYPES[r.type].org,
      badge: isUpcoming(r) ? "Upcoming" : "Past",
      meta: [
        `${TYPES[r.type].label[0].toUpperCase()}${TYPES[r.type].label.slice(1)} · ${fmtDate(r.date)}${r.time ? ` · ${r.time}` : ""}`,
        [r.mode, r.where].filter(Boolean).join(" · "),
        r.team ? `Team: ${r.team}` : "",
      ].filter(Boolean),
      link: `/student/${TYPES[r.type].path}`,
    })),
    suggestions: ["Find Events", "Find Hackathons"],
  };
}

// ---------------------------------------------------------------- Project Support

const PS_SELECT_STUDENT =
  "id, title, status, support_type, project_stage, domain, created_at, updated_at, guidance_feedback, investment_notes, staff:users!assigned_staff_id(name)";

async function psInfo({ user }) {
  if (user.role === "staff") {
    return {
      reply: [
        "**Project Support** lets students ask Xentwin Technologies for **Guidance**, **Investment** support, or **Both** for their projects.",
        "As staff you can take a **Pending** request (it becomes **In Review**), chat with the student, add guidance feedback or investment notes, mark it **Accepted** or **Rejected**, and then **Complete** it. Only the staff member who took a request can update it.",
      ].join("\n"),
      suggestions: ["Pending requests", "My assigned requests"],
      noAI: true,
    };
  }
  return {
    reply: [
      "**Project Support** is Xentwin Technologies' programme for student projects. You can ask for:",
      "**Guidance** — mentoring and feedback from Xentwin staff",
      "**Investment** — a funding discussion (you describe what you need)",
      "**Both** — guidance and investment together",
      "How it works: you submit a request (status **Pending**), a staff member takes it (**In Review**), then decides (**Accepted** or **Rejected**) and finally marks it **Completed**. You can chat with the staff member on the request and you'll get a notification for each update.",
    ].join("\n"),
    suggestions: ["Create a support request", "Check my requests", "Show staff replies"],
    noAI: true,
  };
}

async function psMine({ user, params }) {
  const { data } = await run(
    supabase
      .from("project_support_requests")
      .select(PS_SELECT_STUDENT)
      .eq("student_id", user._id)
      .order("created_at", { ascending: false })
      .limit(50)
  );
  const all = data || [];
  if (!all.length) {
    return {
      reply: "You haven't submitted any Project Support requests yet. I can help you create one — it only takes a minute.",
      suggestions: ["Create a support request", "Explain Project Support"],
    };
  }
  const rows = params.status ? all.filter((r) => r.status === params.status) : all;
  if (!rows.length) {
    return {
      reply: `None of your requests are **${params.status}**. You have ${all.length} in total: ${countLine(countBy(all, (r) => r.status))}.`,
      suggestions: ["Check my requests"],
    };
  }

  let reply = `You have **${rows.length}** Project Support request${rows.length === 1 ? "" : "s"}: ${countLine(countBy(rows, (r) => r.status))}.`;
  if (rows.length > MAX_CARDS) reply += ` Showing the latest ${MAX_CARDS}.`;
  return {
    reply,
    cards: rows.slice(0, MAX_CARDS).map((r) => ({
      kind: "request",
      title: r.title,
      subtitle: "Supported by Xentwin Technologies",
      badge: r.status,
      meta: [
        `${r.support_type} · ${r.project_stage} · ${r.domain}`,
        r.staff?.name ? `Handled by ${r.staff.name}` : "Waiting for a staff member to pick it up",
        `Submitted ${fmtDate(r.created_at)}`,
      ],
      link: "/student/project-support",
    })),
    suggestions: ["Show staff replies", "Create a support request"],
  };
}

async function psReplies({ user }) {
  const { data } = await run(
    supabase
      .from("project_support_requests")
      .select(PS_SELECT_STUDENT)
      .eq("student_id", user._id)
      .order("created_at", { ascending: false })
      .limit(50)
  );
  const requests = data || [];
  if (!requests.length) {
    return {
      reply: "You don't have any Project Support requests yet, so there are no replies. Want to create one?",
      suggestions: ["Create a support request", "Explain Project Support"],
    };
  }

  const ids = requests.map((r) => r.id);
  const titleById = Object.fromEntries(requests.map((r) => [r.id, r.title]));
  const { data: msgs } = await run(
    supabase
      .from("project_support_messages")
      .select("id, request_id, text, created_at, sender:users!sender_id(name, role)")
      .in("request_id", ids)
      .order("created_at", { ascending: false })
      .limit(100)
  );

  const cards = [];
  for (const m of (msgs || []).filter((x) => x.sender?.role === "staff").slice(0, 4)) {
    cards.push({
      kind: "request",
      title: titleById[m.request_id],
      subtitle: `Reply from ${m.sender.name}`,
      badge: fmtDate(m.created_at),
      meta: [clip(m.text, 220)],
      link: "/student/project-support",
    });
  }
  for (const r of requests) {
    if (r.guidance_feedback) {
      cards.push({ kind: "request", title: r.title, subtitle: "Guidance from Xentwin staff", badge: r.status, meta: [clip(r.guidance_feedback, 220)], link: "/student/project-support" });
    }
    if (r.investment_notes) {
      cards.push({ kind: "request", title: r.title, subtitle: "Investment notes from Xentwin staff", badge: r.status, meta: [clip(r.investment_notes, 220)], link: "/student/project-support" });
    }
  }

  if (!cards.length) {
    const pending = requests.filter((r) => r.status === "Pending").length;
    return {
      reply: `No staff replies yet.${pending ? ` ${plural(pending, "of your requests is", "of your requests are")} still **Pending** — staff will reply once someone takes it.` : ""} You'll get a notification as soon as there is one.`,
      suggestions: ["Check my requests"],
    };
  }
  return {
    reply: `Here ${cards.length === 1 ? "is the latest staff reply" : "are the latest staff replies and feedback"} on your Project Support requests. Open the request to continue the conversation.`,
    cards: cards.slice(0, MAX_CARDS),
    suggestions: ["Check my requests"],
  };
}

async function psPending({ user, params }) {
  const status = params.status || "Pending";
  let q = supabase
    .from("project_support_requests")
    .select("id, title, status, support_type, project_stage, domain, created_at, student:users!student_id(name, university)", { count: "exact" })
    .eq("status", status)
    .order("created_at", { ascending: true })
    .range(0, 7);
  if (status === "Pending") q = q.is("assigned_staff_id", null);
  const { data, count } = await run(q);
  const rows = data || [];

  if (!rows.length) {
    return {
      reply: status === "Pending" ? "There are no pending Project Support requests right now. 🎉" : `There are no Project Support requests with status **${status}**.`,
      suggestions: ["My assigned requests", "Applications"],
    };
  }
  const total = count ?? rows.length;
  return {
    reply: `There ${total === 1 ? "is" : "are"} **${total}** ${status === "Pending" ? "pending (unassigned)" : status} Project Support request${total === 1 ? "" : "s"}, oldest first. Open the Project Support page to take one.`,
    cards: rows.map((r) => ({
      kind: "request",
      title: r.title,
      subtitle: [r.student?.name, r.student?.university].filter(Boolean).join(" · ") || "Student",
      badge: r.status,
      meta: [`${r.support_type} · ${r.project_stage} · ${r.domain}`, `Submitted ${fmtDate(r.created_at)}`],
      link: `${base(user)}/project-support`,
    })),
    suggestions: ["My assigned requests", "Applications"],
  };
}

async function psAssigned({ user, params }) {
  const { data } = await run(
    supabase
      .from("project_support_requests")
      .select("id, title, status, support_type, project_stage, domain, updated_at, student:users!student_id(name, university)")
      .eq("assigned_staff_id", user._id)
      .order("updated_at", { ascending: false })
      .limit(100)
  );
  const all = data || [];
  if (!all.length) {
    return { reply: "No Project Support requests are assigned to you yet. Pending ones are waiting to be taken.", suggestions: ["Pending requests"] };
  }
  const showCompleted = params.status === "Completed";
  const rows = params.status ? all.filter((r) => r.status === params.status) : all.filter((r) => r.status !== "Completed");
  const done = all.length - all.filter((r) => r.status !== "Completed").length;

  if (!rows.length) {
    return {
      reply: showCompleted ? "You have no completed requests." : `All ${all.length} request${all.length === 1 ? "" : "s"} assigned to you ${all.length === 1 ? "is" : "are"} completed.`,
      suggestions: ["Pending requests"],
    };
  }
  let reply = `You have **${rows.length}** ${showCompleted ? "completed" : "open"} request${rows.length === 1 ? "" : "s"} assigned to you: ${countLine(countBy(rows, (r) => r.status))}.`;
  if (!params.status && done) reply += ` (${done} more completed.)`;
  return {
    reply,
    cards: rows.slice(0, MAX_CARDS).map((r) => ({
      kind: "request",
      title: r.title,
      subtitle: [r.student?.name, r.student?.university].filter(Boolean).join(" · ") || "Student",
      badge: r.status,
      meta: [`${r.support_type} · ${r.project_stage} · ${r.domain}`, `Updated ${fmtDate(r.updated_at)}`],
      link: `${base(user)}/project-support`,
    })),
    suggestions: ["Pending requests", "Applications"],
  };
}

// ---------------------------------------------------------------- announcements & community

async function announcements({ user, params }) {
  const { data } = await run(
    supabase.from("announcements").select("id, title, body, created_at").order("created_at", { ascending: false }).limit(40)
  );
  let rows = data || [];
  if (!rows.length) return { reply: "There are no announcements yet.", suggestions: ["Find Events", "Find Hackathons"] };

  const terms = strip(params.keywords || [], ["latest", "recent"]);
  let filtered = false;
  if (terms.length) {
    const hit = rows.filter((a) => terms.some((t) => lower(a.title).includes(t) || lower(a.body).includes(t)));
    if (hit.length) { rows = hit; filtered = true; }
  }
  const shown = rows.slice(0, 5);
  return {
    reply: filtered
      ? `Here ${shown.length === 1 ? "is the announcement" : "are the announcements"} about “${terms.join(" ")}”:`
      : terms.length
        ? `I couldn't find an announcement about “${terms.join(" ")}”. Here are the latest ones:`
        : "Here are the latest announcements:",
    cards: shown.map((a) => ({
      kind: "announcement",
      title: a.title,
      subtitle: fmtDate(a.created_at),
      meta: [clip(a.body, 200)],
      link: user.role === "staff" ? "/staff/announcements" : "/student",
    })),
    suggestions: ["Find Events", "Community channels"],
  };
}

async function community({ user, params }) {
  const { data } = await run(supabase.from("channels").select("id, name, description").order("name"));
  const channels = data || [];
  if (!channels.length) {
    return { reply: "There are no community channels yet. Staff can create them from the Community page.", noAI: true };
  }

  const terms = [...(params.keywords || [])];
  if (!terms.length && user.role === "student") terms.push(...(user.skills || []).map(lower));

  const scored = channels
    .map((c) => ({ c, score: terms.filter((t) => termMatches(lower(`${c.name} ${c.description || ""}`), t)).length }))
    .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name));
  const relevant = scored.filter((x) => x.score > 0);
  const picks = (relevant.length ? relevant : scored).slice(0, 6);

  const reply = relevant.length
    ? `These community channels look relevant${params.keywords?.length ? ` to “${params.keywords.join(" ")}”` : " to your skills"}:`
    : `There ${channels.length === 1 ? "is" : "are"} ${plural(channels.length, "community channel")}. ${picks.length < channels.length ? "Here are a few:" : "Here they are:"}`;

  return {
    reply: `${reply}\nOpen **Community** to read posts, comment and chat live with other members.`,
    cards: picks.map((x) => ({
      kind: "channel",
      title: `# ${x.c.name}`,
      subtitle: "Community channel",
      meta: x.c.description ? [clip(x.c.description, 140)] : [],
      link: `${base(user)}/community`,
    })),
    suggestions: ["Latest announcements", "Find Events"],
  };
}

// ---------------------------------------------------------------- staff overview

async function platformStats({ user }) {
  if (user.role !== "staff") {
    return { reply: "Platform-wide numbers are available to staff only. I can show you your own applications, registrations and Project Support requests.", noAI: true };
  }
  const head = (table, filter) => {
    let q = supabase.from(table).select("id", { count: "exact", head: true });
    if (filter) q = filter(q);
    return run(q).then((r) => r.count ?? 0);
  };
  const [students, internships, workshops, events, hackathons, apps, pending] = await Promise.all([
    head("users", (q) => q.eq("role", "student")),
    head("internships"),
    head("workshops"),
    head("events"),
    head("hackathons"),
    head("applications"),
    head("project_support_requests", (q) => q.eq("status", "Pending").is("assigned_staff_id", null)),
  ]);
  return {
    reply: [
      `Platform snapshot: **${students}** ${students === 1 ? "student" : "students"}, **${apps}** internship ${apps === 1 ? "application" : "applications"}.`,
      `**Xentwin Technologies:** ${plural(internships, "internship")}, ${plural(workshops, "workshop")}, ${plural(pending, "pending Project Support request")}.`,
      `**GenAura Technologies:** ${plural(events, "event")}, ${plural(hackathons, "hackathon")}.`,
    ].join("\n"),
    suggestions: ["Pending requests", "Applications", "Upcoming events"],
    noAI: true,
  };
}

// ---------------------------------------------------------------- static answers

function greeting({ user }) {
  const name = firstName(user.name);
  return user.role === "staff"
    ? {
        reply: `Hi ${name}! I'm Xentie. I can show pending Project Support requests, requests assigned to you, applications, and upcoming events, workshops and hackathons.`,
        suggestions: STAFF_ACTIONS,
        noAI: true,
      }
    : {
        reply: `Hi ${name}! I'm Xentie. I can help you find opportunities, check applications, registrations and Project Support.`,
        suggestions: STUDENT_ACTIONS,
        noAI: true,
      };
}

function help({ user }) {
  return user.role === "staff"
    ? {
        reply: [
          "Here is what I can do for you:",
          "• Show **pending** Project Support requests and the ones **assigned to you**",
          "• Summarise **applications** (try “shortlisted applications” or an internship name)",
          "• List **upcoming** events, workshops and hackathons",
          "• Share the latest announcements and community channels, or a platform snapshot",
        ].join("\n"),
        suggestions: STAFF_ACTIONS,
        noAI: true,
      }
    : {
        reply: [
          "Here is what I can do for you:",
          "• **Find** internships, workshops, events and hackathons — by skill, mode or date",
          "• **Recommend** opportunities from your profile and skills",
          "• Check your **applications** and what each status means",
          "• Show your **registrations** and upcoming dates",
          "• Explain **Project Support**, help you create a request, and show staff replies",
          "• Share the latest **announcements** and find community channels",
        ].join("\n"),
        suggestions: STUDENT_ACTIONS,
        noAI: true,
      };
}

function thanks() {
  return { reply: "You're welcome! Ask me anything else whenever you like.", suggestions: [], noAI: true };
}

const FAQ_ANSWERS = {
  apply: {
    student: "To apply for an internship: open **Internships** from the menu, pick one and press **Apply**. Make sure your resume is uploaded in **Profile** first. You can follow the result under **My Applications** — or just ask me “check my applications”.",
    staff: "Students apply from the Internships page. You can review applications and update their status on the **Applications** page.",
    suggestions: ["Find Internships", "Check my applications"],
  },
  register: {
    student: "Open **Workshops**, **Events** or **Hackathons** and press **Register**. Workshops and events register in one click; hackathons ask for your team details (team name, members, college). Registered items show up in your list, and I can summarise them — just ask “show my registrations”.",
    staff: "Students register from the Workshops, Events and Hackathons pages. You can see the registrants of each item on its page.",
    suggestions: ["Find Workshops", "Find Hackathons", "Show my registrations"],
  },
  profile: {
    student: "Open **Profile** from the menu to update your phone, university, course, year and **skills**, and to upload your resume. Keeping skills up to date helps me give you better recommendations.",
    staff: "Staff don't have a student profile. Students manage their skills and resume under Profile; you can view students on the **Students** page.",
    suggestions: ["Recommend for me"],
  },
  notifications: {
    student: "Open **Notifications** from the menu. You get notifications for application status changes, registrations, announcements, community activity and Project Support updates.",
    staff: "Notifications appear in the bell at the top of the page.",
    suggestions: [],
  },
  password: {
    student: "On the login page choose **Forgot password?**, enter your email and follow the link we send you. For your security I can't see or change passwords myself.",
    staff: "On the login page choose **Forgot password?**, enter your email and follow the link we send you. For your security I can't see or change passwords myself.",
    suggestions: [],
  },
  orgs: {
    student: "The two organisations stay separate on the platform:\n**Xentwin Technologies** — internships, workshops and Project Support.\n**GenAura Technologies** — events and hackathons.",
    staff: "The two organisations stay separate on the platform:\n**Xentwin Technologies** — internships, workshops and Project Support.\n**GenAura Technologies** — events and hackathons.",
    suggestions: ["Find Internships", "Find Hackathons"],
  },
  community_how: {
    student: "**Community** has channels for different topics. Open a channel to read posts, add your own post, comment on others and chat live. Ask me “which channels are relevant to AI?” and I'll point you to the right ones.",
    staff: "**Community** has channels for different topics. You can create or remove channels from the Community page and take part in the conversations.",
    suggestions: ["Community channels"],
  },
  about: {
    student: "I'm **Xentie**, the Community AI Assistant. I can find opportunities, check your applications and registrations, and help with Project Support.",
    staff: "I'm **Xentie**, the Community AI Assistant. I can show Project Support requests, applications and upcoming events, workshops and hackathons.",
    suggestions: [],
  },
};

function faq({ user, params }) {
  const a = FAQ_ANSWERS[params.topic];
  if (!a) return unknown();
  return { reply: a[user.role === "staff" ? "staff" : "student"], suggestions: a.suggestions, noAI: true };
}

function unknown() {
  return {
    reply: "I'm not sure I understood that. I can help with opportunities, applications, registrations, Project Support, announcements and the community. Try one of these:",
    suggestions: STUDENT_ACTIONS,
    isUnknown: true,
  };
}

const STUDENT_ACTIONS = ["Find Internships", "Find Workshops", "Find Events", "Find Hackathons", "Check Applications", "Project Support"];
const STAFF_ACTIONS = ["Pending requests", "My assigned requests", "Applications", "Upcoming events", "Upcoming hackathons", "Upcoming workshops"];

const HANDLERS = {
  greeting,
  help,
  thanks,
  faq,
  find_opportunity: findOpportunity,
  recommend,
  applications,
  app_status_explain: appStatusExplain,
  registrations,
  ps_info: psInfo,
  ps_mine: psMine,
  ps_replies: psReplies,
  ps_pending: psPending,
  ps_assigned: psAssigned,
  announcements,
  community,
  platform_stats: platformStats,
  unknown,
};

// which role may use which intent ("both" is the default)
const STUDENT_ONLY = new Set(["recommend", "app_status_explain", "ps_mine", "ps_replies", "ps_create"]);
const STAFF_ONLY = new Set(["ps_pending", "ps_assigned", "platform_stats"]);

module.exports = { HANDLERS, STUDENT_ONLY, STAFF_ONLY, STUDENT_ACTIONS, STAFF_ACTIONS };

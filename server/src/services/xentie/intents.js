// Xentie — intent detection (rule based, fast, no AI needed) and filter parsing.

const { DAY, zonedParts, zonedMidnight, dayStart, weekday, keywords } = require("./utils");

const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5,
  jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

// ---------------------------------------------------------------- filters

function parseTypes(t) {
  const types = [];
  if (/\b(internships?|interns?)\b/.test(t)) types.push("internship");
  if (/\b(workshops?|trainings?|bootcamps?|webinars?|classes|sessions?)\b/.test(t)) types.push("workshop");
  if (/\b(events?|meetups?|conferences?|seminars?)\b/.test(t)) types.push("event");
  if (/\b(hackathons?|hacks?|competitions?|contests?)\b/.test(t)) types.push("hackathon");
  return types;
}

function parseMode(t) {
  if (/\b(remote|online|virtual)\b/.test(t)) return "remote";
  if (/\b(on-?site|offline|in-?person|physical)\b/.test(t)) return "onsite";
  if (/\bhybrid\b/.test(t)) return "hybrid";
  return null;
}

/** { label, from (ms), to (ms | null) } or null */
function parseTimeframe(t, now = new Date()) {
  const today = dayStart(now);
  const dow = weekday(now);
  const p = zonedParts(now);

  if (/\btoday\b/.test(t)) return { label: "today", from: now.getTime(), to: today + DAY - 1 };
  if (/\btomorrow\b/.test(t)) return { label: "tomorrow", from: today + DAY, to: today + 2 * DAY - 1 };

  if (/\b(this|coming)\s+weekend\b/.test(t)) {
    const toSat = (6 - dow + 7) % 7;
    const sat = today + toSat * DAY;
    return { label: "this weekend", from: Math.max(sat, now.getTime()), to: sat + 2 * DAY - 1 };
  }
  if (/\bnext\s+week\b/.test(t)) {
    const toMon = ((8 - dow) % 7) || 7;
    const mon = today + toMon * DAY;
    return { label: "next week", from: mon, to: mon + 7 * DAY - 1 };
  }
  if (/\bthis\s+week\b/.test(t)) {
    const toSun = (7 - dow) % 7;
    return { label: "this week", from: now.getTime(), to: today + (toSun + 1) * DAY - 1 };
  }
  if (/\bthis\s+month\b/.test(t)) {
    return { label: "this month", from: now.getTime(), to: zonedMidnight(p.y, p.m + 1, 1) - 1 };
  }
  if (/\bnext\s+month\b/.test(t)) {
    return { label: "next month", from: zonedMidnight(p.y, p.m + 1, 1), to: zonedMidnight(p.y, p.m + 2, 1) - 1 };
  }
  const days = /\b(?:next|within|in the next|in)\s+(\d{1,3})\s+days?\b/.exec(t);
  if (days) {
    return { label: `the next ${days[1]} days`, from: now.getTime(), to: now.getTime() + Number(days[1]) * DAY };
  }
  const month = /\b(?:in|during|for|of|on)\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\b/.exec(t);
  if (month) {
    const m = MONTHS[month[1]];
    const y = m >= p.m ? p.y : p.y + 1;
    return {
      label: `in ${month[1][0].toUpperCase()}${month[1].slice(1)}`,
      from: Math.max(zonedMidnight(y, m, 1), now.getTime()),
      to: zonedMidnight(y, m + 1, 1) - 1,
    };
  }
  return null;
}

function parseStatus(t) {
  if (/\bshort-?list(ed|ing)?\b/.test(t)) return "Shortlisted";
  if (/\b(selected|selection|accepted|offer(ed)?)\b/.test(t)) return "Selected";
  if (/\b(rejected|rejection|declined|not selected)\b/.test(t)) return "Rejected";
  if (/\b(under review|in review|reviewing|being reviewed)\b/.test(t)) return "Under Review";
  return null;
}

const PS_STATUS = [
  ["In Review", /\b(in review|under review|reviewing)\b/],
  ["Pending", /\bpending\b/],
  ["Accepted", /\baccepted\b/],
  ["Rejected", /\brejected\b/],
  ["Completed", /\b(completed|complete|closed|done)\b/],
];
function parsePsStatus(t) {
  for (const [status, re] of PS_STATUS) if (re.test(t)) return status;
  return null;
}

// ---------------------------------------------------------------- safety checks

const SECRET_ASK =
  /\b(api[\s_-]?keys?|secret[\s_-]?keys?|service[\s_-]?role|smtp|\.env|env file|environment variables?|jwt|bearer token|access token|auth token|credentials?|database url|connection string|supabase (key|url|secret)|cloudinary (key|secret)|password hash|passwords?)\b/;
const SECRET_OK = /\b(reset|forgot|forget|change|recover|lost|new password|set password|create password)\b/;

function asksForSecrets(t) {
  return SECRET_ASK.test(t) && !SECRET_OK.test(t);
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
function asksForOtherUsers(t) {
  if (EMAIL_RE.test(t)) return true;
  if (/\bwho\s+(has\s+|have\s+|all\s+)?(registered|applied|joined|enrolled|signed up|submitted)\b/.test(t)) return true;
  if (/\b(all|every|other|another|different)\s+students?\b/.test(t)) return true;
  if (/\b(someone|somebody|anyone|everyone|classmate|friend|his|her)('?s)?\s+(application|applications|profile|resume|cv|project|request|requests|registration|registrations|details|phone|email|marks)\b/.test(t)) return true;
  if (/\b(someone|somebody|another student|other student|a student)\b.*\b(application|profile|resume|project|request|registration|phone|email)\b/.test(t)) return true;
  if (/\b\w+'s\s+(application|applications|profile|resume|cv|project support|request|requests|registration|registrations)\b/.test(t)) return true;
  if (/\bstudents?\s+(named|called)\b/.test(t)) return true;
  return false;
}

// ---------------------------------------------------------------- FAQ

const FAQ = [
  { id: "apply", re: /\bhow\b.*\b(apply|applying)\b|\bhow to apply\b|\bapply (for|to) (an? )?internship/ },
  { id: "register", re: /\bhow\b.*\b(register|registering|join|sign ?up|enrol+)\b|\bhow to register\b/ },
  { id: "profile", re: /\b(update|edit|change|add|upload|fill)\b.*\b(profile|resume|cv|skills)\b|\bhow\b.*\b(resume|cv)\b/ },
  { id: "notifications", re: /\bnotifications?\b/ },
  { id: "password", re: /\b(forgot|forget|reset|change|recover|lost)\b.*\bpassword\b|\bpassword\b.*\b(forgot|reset|change)\b/ },
  { id: "orgs", re: /\b(who (runs|organi[sz]es|offers|conducts|are)|difference between|what (is|are|does)) .*\b(xentwin|genaura|gen aura)\b|\b(xentwin|genaura|gen aura)\b.*\b(who|difference|what does|what do)\b/ },
  { id: "community_how", re: /\bhow\b.*\b(post|comment|reply|chat|message|talk)\b.*\b(community|channel)|\bhow does (the )?community work|\bwhat is (the )?community\b/ },
  { id: "about", re: /\b(who are you|what are you|what is xentie|who is xentie|your name)\b/ },
];

// ---------------------------------------------------------------- main

const GREETING = /^(hi+|hello+|hey+|hola|namaste|good (morning|afternoon|evening)|yo|sup)\b[\s!.?,]*(xentie)?[\s!.?]*$/;
const THANKS = /^(thanks?|thank you|thx|ty|ok(ay)?|cool|great|nice|awesome|got it|perfect)\b[\s!.]*$/;
const HELP = /^(help|menu|options|what can you do\??|what do you do\??|how can you help( me)?\??|commands)\b[\s!.?]*$/;

const PS_WORDS = /\b(project support|support request|support requests|project help|project request|project requests)\b/;

/**
 * Returns { intent, params }.
 * Intents: greeting, thanks, help, faq, ps_create, ps_info, ps_mine, ps_replies, ps_pending, ps_assigned,
 *          applications, app_status_explain, registrations, recommend, announcements, community,
 *          platform_stats, find_opportunity, unknown
 */
function detectIntent(rawText, role) {
  const t = String(rawText || "").toLowerCase().replace(/\s+/g, " ").trim();
  const now = new Date();

  if (GREETING.test(t)) return { intent: "greeting", params: {} };
  if (THANKS.test(t)) return { intent: "thanks", params: {} };
  if (HELP.test(t)) return { intent: "help", params: {} };

  for (const f of FAQ) if (f.re.test(t)) return { intent: "faq", params: { topic: f.id } };

  const isStaff = role === "staff";

  // ---- Project Support
  if (isStaff && (PS_WORDS.test(t) || /\brequests?\b/.test(t) || /\bassigned to me\b/.test(t))) {
    if (/\b(what is|what's|explain|how does|how do|tell me about)\b/.test(t)) return { intent: "ps_info", params: {} };
    const mine = /\b(assigned|my|mine|taken)\b/.test(t);
    return { intent: mine ? "ps_assigned" : "ps_pending", params: { status: parsePsStatus(t) } };
  }
  if (!isStaff) {
    if (/\b(create|submit|raise|start|make|add|open|file|send)\b.*\b(project support|support request|project help|request)\b/.test(t) ||
        /^(new (support )?request)\b/.test(t) ||
        /\bapply for (project support|support)\b/.test(t)) {
      if (!/\b(how|what|explain)\b/.test(t)) return { intent: "ps_create", params: {} };
    }
    const psContext =
      PS_WORDS.test(t) ||
      /\b(my )?(project|support)\b.*\b(request|requests)\b/.test(t) ||
      /\bmy project\b/.test(t) ||
      /\b(my|pending|open|all) requests?\b/.test(t) ||
      /\bstaff (repl|respon|feedback|message|comment)/.test(t);
    if (psContext) {
      if (/\b(repl(y|ies|ied)|respon(d|se|ses|ded)|feedback|messages?|guidance from|said|comments?)\b/.test(t)) {
        return { intent: "ps_replies", params: {} };
      }
      if (/\b(status|my|mine|check|track|show|where|progress|pending|accepted|rejected|completed|in review|how is|updates?)\b/.test(t) &&
          !/\b(what is|what's|explain|how does|how do|tell me about)\b/.test(t)) {
        return { intent: "ps_mine", params: { status: parsePsStatus(t) } };
      }
      return { intent: "ps_info", params: {} };
    }
    if (/\b(guidance|mentor(ing|ship)?|investment|funding|invest)\b/.test(t) && /\b(project|idea|startup|prototype)\b/.test(t)) {
      return { intent: "ps_info", params: {} };
    }
  }

  // ---- Applications
  if (/\b(what does|what do|meaning of|what is|explain|difference)\b.*\b(applied|under review|shortlisted|selected|rejected|status|statuses)\b/.test(t) && !PS_WORDS.test(t)) {
    return { intent: "app_status_explain", params: { status: parseStatus(t) } };
  }
  if (/\b(applications?|applied|short-?listed|rejected|under review|applicants?)\b/.test(t) || /\bstatus of my\b/.test(t) || /\bam i (selected|shortlisted|rejected)\b/.test(t)) {
    return { intent: "applications", params: { status: parseStatus(t), keywords: keywords(t) } };
  }

  // ---- Registrations
  if (/\b(regist(ered|rations?)|my (workshops?|events?|hackathons?)|enrolled|signed up)\b/.test(t) && !/\bhow\b/.test(t)) {
    return {
      intent: "registrations",
      params: { types: parseTypes(t), upcomingOnly: /\b(upcoming|next|soon|future|coming)\b/.test(t) },
    };
  }

  // ---- Recommendations
  if (/\b(recommend(ed|ation|ations)?|suggest(ion|ions)?|for me|match(es)? (my|with)|personali[sz]ed|best for me|based on my|what should i (apply|join|do|try|attend)|fits? me|right for me)\b/.test(t)) {
    return { intent: "recommend", params: { types: parseTypes(t) } };
  }

  // ---- Announcements
  if (/\b(announcements?|announce|notice board|latest news|what'?s new)\b/.test(t)) {
    return { intent: "announcements", params: { keywords: keywords(t) } };
  }

  // ---- Community
  if (/\b(community|channels?|discussions?|forum|chat ?rooms?)\b/.test(t)) {
    return { intent: "community", params: { keywords: keywords(t) } };
  }

  // ---- Staff stats
  if (isStaff && /\b(how many|count|total|stats|statistics|overview|summary|numbers)\b/.test(t)) {
    return { intent: "platform_stats", params: {} };
  }

  // ---- Opportunity finder
  const types = parseTypes(t);
  if (types.length || /\b(opportunit(y|ies)|find|search|looking for|any (open|available))\b/.test(t)) {
    return {
      intent: "find_opportunity",
      params: { types, mode: parseMode(t), timeframe: parseTimeframe(t, now), keywords: keywords(t) },
    };
  }

  return { intent: "unknown", params: {} };
}

module.exports = {
  detectIntent, asksForSecrets, asksForOtherUsers,
  parseTypes, parseMode, parseTimeframe, parseStatus, parsePsStatus,
};

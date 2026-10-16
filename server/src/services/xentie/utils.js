// Shared helpers for Xentie: time zone handling, text clean-up and formatting.

const DAY = 24 * 60 * 60 * 1000;

function timeZone() {
  const tz = process.env.XENTIE_TIMEZONE || "Asia/Kolkata";
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

function zonedParts(date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone(),
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((x) => [x.type, x.value])
  );
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second };
}

function tzOffsetMs(date) {
  const p = zonedParts(date);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(date.getTime() / 1000) * 1000;
}

/** Instant (ms) of local midnight for the given calendar day in the configured time zone. */
function zonedMidnight(y, m, d) {
  const guess = Date.UTC(y, m - 1, d);
  return guess - tzOffsetMs(new Date(guess));
}

function dayStart(date) {
  const p = zonedParts(date);
  return zonedMidnight(p.y, p.m, p.d);
}

/** 0 = Sunday … 6 = Saturday, in the configured time zone */
function weekday(date) {
  const p = zonedParts(date);
  return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
}

function fmtDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timeZone(),
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

function clip(value, max = 140) {
  const s = String(value ?? "").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many || `${one}s`}`;
}

function firstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "there";
}

const STOP_WORDS = new Set(
  (
    "a an the and or of for to in on at by with about from into onto over under near " +
    "i me my mine we us our you your is are was were be been am do does did can could should would will shall may might " +
    "please pls plz show list give get tell find search look looking want need like any some all every each " +
    "what which who whom whose when where why how there here this that these those it its " +
    "available open new latest current currently upcoming soon next recent related based relevant " +
    "domain skill skills date dates mode type kind opportunity opportunities " +
    "internship internships intern workshop workshops event events hackathon hackathons competition competitions contest " +
    "training trainings bootcamp meetup conference " +
    "remote online virtual onsite on-site offline hybrid in-person inperson " +
    "today tomorrow week weekend month year this " +
    "application applications applied status check track details detail info information " +
    "registered registration registrations register announcement announcements notice news " +
    "community channel channels project support request requests staff reply replies " +
    "more also just only still yet already again one ones thing things something anything " +
    "join joined joining follow interested interest topic topics relevant should recommend suggest " +
    "january february march april june july august september october november december jan feb apr jun jul aug sep sept oct nov dec " +
    "xentie hi hello hey thanks thank ok okay yes no"
  ).split(/\s+/)
);

/** Meaningful search words left after removing filler, type and filter words. */
function keywords(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s/-]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^[-./]+|[-./]+$/g, ""))
    .filter((w) => w && (w.length >= 2 || w === "c") && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
}

module.exports = {
  DAY, timeZone, zonedParts, zonedMidnight, dayStart, weekday,
  fmtDate, clip, plural, firstName, keywords, STOP_WORDS,
};

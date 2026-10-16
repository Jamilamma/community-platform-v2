const supabase = require("../config/supabase");

// ---------------------------------------------------------------- naming

const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const snake = (s) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

// Postgres returns "2026-10-10T00:00:00+00:00"; MongoDB/JSON returned "...T00:00:00.000Z".
// Normalise so the client sees the exact same format as before.
const PG_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}(:\d{2})?|Z)$/;

/**
 * Converts a Supabase row (snake_case, `id`, `student_id`) into the shape the
 * MongoDB API returned (camelCase, `_id`, `student`), so the React client keeps
 * working unchanged.
 *
 *  - id            -> _id (and id)
 *  - student_id    -> student   (unless an embedded `student` object is present,
 *                                which is the equivalent of Mongoose populate())
 *  - created_at    -> createdAt
 */
function toDoc(value) {
  if (Array.isArray(value)) return value.map(toDoc);
  if (value === null || typeof value !== "object" || value instanceof Date) return value;

  const out = {};
  for (const [key, v] of Object.entries(value)) {
    if (key === "id") {
      out._id = v;
      out.id = v;
    } else if (key.endsWith("_id")) {
      const base = camel(key.slice(0, -3));
      if (!(base in value)) out[base] = v;
    } else {
      out[camel(key)] = toDoc(v);
    }
  }
  // dates last so they are converted after recursion
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === "string" && PG_TIMESTAMP.test(v)) out[k] = new Date(v).toISOString();
  }
  return out;
}

// ---------------------------------------------------------------- errors

const STATUS_BY_CODE = {
  "23505": 409, // unique_violation
  "23502": 400, // not_null_violation
  "23514": 400, // check_violation
  "23503": 400, // foreign_key_violation
  "22P02": 400, // invalid_text_representation (e.g. malformed uuid / integer)
  "22007": 400, // invalid_datetime_format
  "22008": 400, // datetime_field_overflow
  "22003": 400, // numeric_value_out_of_range
  "22001": 400, // string_data_right_truncation
};

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * supabase-js returns { data, error } instead of throwing. This throws so the
 * controllers' existing try/catch -> next(err) pattern keeps working.
 * `err.code` keeps the Postgres code (23505 = the old Mongo 11000 duplicate error).
 */
function unwrap({ data, error }) {
  if (!error) return data;
  const err = new Error(error.message);
  err.code = error.code;
  err.status = STATUS_BY_CODE[error.code] || 500;
  if (error.code === "23502") {
    const col = /column "([^"]+)"/.exec(error.message)?.[1];
    if (col) err.message = `${camel(col)} is required`;
  } else if (error.code === "22P02") {
    err.message = "Invalid value or id in request";
  }
  throw err;
}

// ---------------------------------------------------------------- request bodies

/**
 * Whitelists and converts a request body into a Postgres row.
 * spec: { fieldName: type } where type is one of
 *   text | req (text that may not be blank) | date | number | array | enum
 * `undefined` fields are skipped (so DB defaults apply / updates leave them alone).
 * Empty strings for date/number/enum become NULL (Mongoose did the same casting).
 */
function pickRow(body, spec) {
  const row = {};
  for (const [field, type] of Object.entries(spec)) {
    let v = body?.[field];
    if (v === undefined) continue;

    if (type === "date" || type === "number" || type === "enum") {
      if (v === "" || v === null) v = null;
      else if (type === "number") {
        v = Number(v);
        if (Number.isNaN(v)) throw httpError(400, `${field} must be a number`);
      }
    } else if (type === "array") {
      if (v === null) v = [];
      else if (!Array.isArray(v)) v = [v];
      v = v.map(String);
    } else {
      if (v !== null && typeof v !== "string") v = String(v);
      if (type === "req" && (v === null || !v.trim())) throw httpError(400, `${field} is required`);
    }
    row[snake(field)] = v;
  }
  return row;
}

// ---------------------------------------------------------------- queries

/** Search text -> safe ILIKE fragment (strips characters that are special in PostgREST filters). */
function searchTerm(raw) {
  if (!raw) return "";
  return String(raw).replace(/[%_,()*\\"]/g, " ").replace(/\s+/g, " ").trim();
}

/** PostgREST caps a single response at 1000 rows by default; page through to get them all. */
async function fetchAll(makeQuery, pageSize = 1000) {
  const all = [];
  for (let from = 0; ; from += pageSize) {
    const page = unwrap(await makeQuery().range(from, from + pageSize - 1));
    all.push(...page);
    if (page.length < pageSize) break;
  }
  return all;
}

async function findById(table, id, select = "*") {
  return unwrap(await supabase.from(table).select(select).eq("id", id).maybeSingle());
}

async function updateById(table, id, row, select = "*") {
  if (!Object.keys(row).length) return findById(table, id, select); // nothing to change
  return unwrap(await supabase.from(table).update(row).eq("id", id).select(select).maybeSingle());
}

async function deleteById(table, id) {
  return unwrap(await supabase.from(table).delete().eq("id", id).select().maybeSingle());
}

// Columns of `users` that are safe to return (everything except password_hash).
const USER_PUBLIC =
  "id, name, email, role, phone, university, course, year, skills, resume_url, resume_name, created_at, updated_at";

module.exports = {
  supabase, toDoc, camel, snake, httpError, unwrap, pickRow, searchTerm,
  fetchAll, findById, updateById, deleteById, USER_PUBLIC,
};

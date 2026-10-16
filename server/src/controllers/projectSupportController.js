const { supabase, toDoc, unwrap, pickRow, httpError, fetchAll } = require("../utils/db");
const { createNotification } = require("../services/notificationService");

// ---------------------------------------------------------------- constants

const STAGES = ["Idea", "Prototype", "MVP", "Beta", "Live"];
const SUPPORT_TYPES = ["Guidance", "Investment", "Both"];
const FILTERABLE_STATUSES = ["Pending", "In Review", "Accepted", "Rejected", "Completed"];
// statuses staff can set directly (Pending is only the initial state; Completed has its own endpoint)
const STAFF_SETTABLE = ["In Review", "Accepted", "Rejected"];

const REQUEST_SELECT =
  "*, student:users!student_id(id, name, email, phone, university, course, year), " +
  "staff:users!assigned_staff_id(id, name, email)";

// ---------------------------------------------------------------- helpers

async function getRequest(id) {
  return unwrap(
    await supabase.from("project_support_requests").select(REQUEST_SELECT).eq("id", id).maybeSingle()
  );
}

async function addHistory(requestId, actorId, action, { fromStatus = null, toStatus = null, note = null } = {}) {
  unwrap(
    await supabase.from("project_support_history").insert({
      request_id: requestId,
      actor_id: actorId,
      action,
      from_status: fromStatus,
      to_status: toStatus,
      note,
    })
  );
}

// Loads a request and checks the caller may act on it.
//   student -> must own it
//   staff   -> any request (read) / only the assigned staff (write)
async function loadForUser(req, { write = false } = {}) {
  const request = await getRequest(req.params.id);
  if (!request) throw httpError(404, "Request not found");

  if (req.user.role === "student") {
    if (request.student_id !== req.user._id) throw httpError(404, "Request not found");
    return request;
  }
  if (write && request.assigned_staff_id !== req.user._id) {
    throw httpError(403, "Take this request first — only the assigned staff member can do this");
  }
  return request;
}

function ensureOpen(request) {
  if (request.status === "Completed") throw httpError(400, "This request is completed");
}

// ---------------------------------------------------------------- student

// POST /api/project-support
async function create(req, res, next) {
  try {
    const row = pickRow(req.body, {
      title: "req",
      description: "req",
      domain: "req",
      projectStage: "req",
      supportType: "req",
      investmentRequired: "text",
      demoLink: "text",
      message: "text",
    });

    if (!STAGES.includes(row.project_stage)) throw httpError(400, "Invalid project stage");
    if (!SUPPORT_TYPES.includes(row.support_type)) throw httpError(400, "Invalid support type");

    const needsInvestment = row.support_type !== "Guidance";
    if (needsInvestment && !(row.investment_required || "").trim()) {
      throw httpError(400, "Investment required is needed for Investment / Both requests");
    }
    if (!needsInvestment) row.investment_required = null;

    row.demo_link = (row.demo_link || "").trim() || null;
    if (row.demo_link && !/^https?:\/\//i.test(row.demo_link)) {
      throw httpError(400, "GitHub / demo link must start with http:// or https://");
    }

    const message = (row.message || "").trim();
    delete row.message; // the initial message goes into the conversation too
    row.message = message || null;

    const created = unwrap(
      await supabase
        .from("project_support_requests")
        .insert({ ...row, student_id: req.user._id })
        .select(REQUEST_SELECT)
        .single()
    );

    await addHistory(created.id, req.user._id, "Submitted", { toStatus: "Pending" });
    if (message) {
      unwrap(
        await supabase
          .from("project_support_messages")
          .insert({ request_id: created.id, sender_id: req.user._id, text: message })
      );
    }

    // let every online staff member's dashboard know there is a new request
    const io = req.app.get("io");
    if (io) io.emit("project-support:new", { requestId: created.id, title: created.title });

    res.status(201).json(toDoc(created));
  } catch (err) {
    next(err);
  }
}

// GET /api/project-support/mine
async function mine(req, res, next) {
  try {
    const rows = unwrap(
      await supabase
        .from("project_support_requests")
        .select(REQUEST_SELECT)
        .eq("student_id", req.user._id)
        .order("created_at", { ascending: false })
    );
    res.json(toDoc(rows));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------- staff

// GET /api/project-support?supportType=Guidance|Investment|Both&status=&scope=all|unassigned|mine
async function list(req, res, next) {
  try {
    const { supportType, status, scope } = req.query;
    if (supportType && !SUPPORT_TYPES.includes(supportType)) throw httpError(400, "Invalid support type");
    if (status && !FILTERABLE_STATUSES.includes(status)) throw httpError(400, "Invalid status");

    const rows = await fetchAll(() => {
      let q = supabase
        .from("project_support_requests")
        .select(REQUEST_SELECT)
        .order("created_at", { ascending: false })
        .order("id");
      if (supportType) q = q.eq("support_type", supportType);
      if (status) q = q.eq("status", status);
      if (scope === "mine") q = q.eq("assigned_staff_id", req.user._id);
      if (scope === "unassigned") q = q.is("assigned_staff_id", null);
      return q;
    });
    res.json(toDoc(rows));
  } catch (err) {
    next(err);
  }
}

// POST /api/project-support/:id/take
async function take(req, res, next) {
  try {
    // atomic: only succeeds while the request is still Pending and unassigned
    const taken = unwrap(
      await supabase
        .from("project_support_requests")
        .update({ assigned_staff_id: req.user._id, status: "In Review" })
        .eq("id", req.params.id)
        .eq("status", "Pending")
        .is("assigned_staff_id", null)
        .select("id, student_id, title")
        .maybeSingle()
    );

    if (!taken) {
      const existing = await getRequest(req.params.id);
      if (!existing) return res.status(404).json({ message: "Request not found" });
      return res.status(409).json({ message: "This request has already been taken by another staff member" });
    }

    await addHistory(taken.id, req.user._id, "Taken", {
      fromStatus: "Pending",
      toStatus: "In Review",
      note: `Assigned to ${req.user.name}`,
    });

    await createNotification(
      taken.student_id,
      "project_support",
      `${req.user.name} from Xentwin Technologies is now reviewing your project support request "${taken.title}".`,
      req.app.get("io")
    );

    res.json(toDoc(await getRequest(taken.id)));
  } catch (err) {
    next(err);
  }
}

// PATCH /api/project-support/:id/notes  { guidanceFeedback?, investmentNotes? }
async function saveNotes(req, res, next) {
  try {
    const request = await loadForUser(req, { write: true });
    ensureOpen(request);

    const row = pickRow(req.body, { guidanceFeedback: "text", investmentNotes: "text" });
    if (row.guidance_feedback !== undefined && request.support_type === "Investment") {
      throw httpError(400, "This request is for Investment only — guidance feedback does not apply");
    }
    if (row.investment_notes !== undefined && request.support_type === "Guidance") {
      throw httpError(400, "This request is for Guidance only — investment notes do not apply");
    }
    if (!Object.keys(row).length) throw httpError(400, "Nothing to update");

    unwrap(await supabase.from("project_support_requests").update(row).eq("id", request.id));

    const changed = [];
    if (row.guidance_feedback !== undefined) {
      changed.push("guidance / feedback");
      await addHistory(request.id, req.user._id, "Guidance Updated");
    }
    if (row.investment_notes !== undefined) {
      changed.push("investment decision / notes");
      await addHistory(request.id, req.user._id, "Investment Notes Updated");
    }

    await createNotification(
      request.student_id,
      "project_support",
      `Xentwin Technologies staff updated the ${changed.join(" and ")} on your request "${request.title}".`,
      req.app.get("io")
    );

    res.json(toDoc(await getRequest(request.id)));
  } catch (err) {
    next(err);
  }
}

// PATCH /api/project-support/:id/status  { status: "In Review" | "Accepted" | "Rejected", note? }
async function updateStatus(req, res, next) {
  try {
    const { status, note } = req.body;
    if (!STAFF_SETTABLE.includes(status)) {
      throw httpError(400, `Status must be one of: ${STAFF_SETTABLE.join(", ")} (use Complete to finish a request)`);
    }
    const request = await loadForUser(req, { write: true });
    ensureOpen(request);
    if (request.status === status) return res.json(toDoc(request));

    unwrap(await supabase.from("project_support_requests").update({ status }).eq("id", request.id));
    await addHistory(request.id, req.user._id, "Status Changed", {
      fromStatus: request.status,
      toStatus: status,
      note: (note || "").trim() || null,
    });

    await createNotification(
      request.student_id,
      "project_support",
      `Your project support request "${request.title}" is now ${status}.`,
      req.app.get("io")
    );

    res.json(toDoc(await getRequest(request.id)));
  } catch (err) {
    next(err);
  }
}

// POST /api/project-support/:id/complete   (only after a decision: Accepted or Rejected)
async function complete(req, res, next) {
  try {
    const request = await loadForUser(req, { write: true });
    ensureOpen(request);
    if (!["Accepted", "Rejected"].includes(request.status)) {
      throw httpError(400, "A request can be completed only after it is Accepted or Rejected");
    }

    unwrap(
      await supabase
        .from("project_support_requests")
        .update({ status: "Completed", completed_at: new Date().toISOString() })
        .eq("id", request.id)
    );
    await addHistory(request.id, req.user._id, "Completed", {
      fromStatus: request.status,
      toStatus: "Completed",
    });

    await createNotification(
      request.student_id,
      "project_support",
      `Your project support request "${request.title}" has been completed.`,
      req.app.get("io")
    );

    res.json(toDoc(await getRequest(request.id)));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------- shared (student <-> staff)

// GET /api/project-support/:id  -> request + conversation + history
async function getOne(req, res, next) {
  try {
    const request = await loadForUser(req);
    const [messages, history] = await Promise.all([
      supabase
        .from("project_support_messages")
        .select("*, sender:users!sender_id(id, name, role)")
        .eq("request_id", request.id)
        .order("created_at"),
      supabase
        .from("project_support_history")
        .select("*, actor:users!actor_id(id, name, role)")
        .eq("request_id", request.id)
        .order("created_at"),
    ]);
    res.json({
      ...toDoc(request),
      messages: toDoc(unwrap(messages)),
      history: toDoc(unwrap(history)),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/project-support/:id/messages  { text }
// student: on their own request | staff: only the assigned staff member
async function postMessage(req, res, next) {
  try {
    const text = (req.body.text || "").trim();
    if (!text) throw httpError(400, "Message cannot be empty");

    const request = await loadForUser(req, { write: req.user.role === "staff" });
    ensureOpen(request);
    if (req.user.role === "staff" && !request.assigned_staff_id) {
      throw httpError(403, "Take this request first");
    }

    const row = unwrap(
      await supabase
        .from("project_support_messages")
        .insert({ request_id: request.id, sender_id: req.user._id, text })
        .select("*, sender:users!sender_id(id, name, role)")
        .single()
    );
    const message = toDoc(row);

    const io = req.app.get("io");
    if (req.user.role === "staff") {
      // student gets a notification (bell + live) and the live message
      await createNotification(
        request.student_id,
        "project_support",
        `${req.user.name} replied to your project support request "${request.title}".`,
        io
      );
      if (io) io.to(`user:${request.student_id}`).emit("project-support:message", { requestId: request.id, message });
    } else if (io && request.assigned_staff_id) {
      io.to(`user:${request.assigned_staff_id}`).emit("project-support:message", { requestId: request.id, message });
    }

    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
}

module.exports = { create, mine, list, take, saveNotes, updateStatus, complete, getOne, postMessage };

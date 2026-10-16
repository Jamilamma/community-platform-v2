// Xentie — guided "create a Project Support request" conversation.
//
// The server is stateless: the chat client echoes back the `state` object it received.
// Because that state is client-controlled it is sanitised on every turn, and the final
// insert re-validates every field exactly like projectSupportController.create does.
// The student id always comes from the authenticated user, never from the state.

const { supabase } = require("../../utils/db");
const { fmtDate } = require("./utils");

const DOMAINS = [
  "Web Development", "Mobile App", "AI / Machine Learning", "Data Science", "IoT / Embedded",
  "Cybersecurity", "Blockchain", "Cloud / DevOps", "AR / VR", "FinTech", "HealthTech", "EdTech", "Other",
];
const STAGES = ["Idea", "Prototype", "MVP", "Beta", "Live"];
const SUPPORT_TYPES = ["Guidance", "Investment", "Both"];
const STEPS = ["title", "description", "domain", "stage", "type", "investment", "demo", "confirm"];

const CANCEL = /^(cancel|stop|quit|exit|abort|never ?mind|forget it|no thanks)\b/i;

async function run(q) {
  const r = await q;
  if (r.error) {
    const e = new Error(r.error.message);
    e.code = r.error.code;
    throw e;
  }
  return r;
}

function sanitizeState(raw) {
  if (!raw || raw.flow !== "ps_create" || !STEPS.includes(raw.step)) return null;
  const d = raw.draft && typeof raw.draft === "object" ? raw.draft : {};
  const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : undefined);
  return {
    flow: "ps_create",
    step: raw.step,
    draft: {
      title: str(d.title, 120),
      description: str(d.description, 1500),
      domain: DOMAINS.includes(d.domain) ? d.domain : undefined,
      projectStage: STAGES.includes(d.projectStage) ? d.projectStage : undefined,
      supportType: SUPPORT_TYPES.includes(d.supportType) ? d.supportType : undefined,
      investmentRequired: str(d.investmentRequired, 200),
      demoLink: str(d.demoLink, 300),
    },
  };
}

// matches "2", "web dev", "ai", "Prototype" … against a list of options
function pick(text, options) {
  const t = text.toLowerCase().trim();
  if (/^\d+$/.test(t)) return options[Number(t) - 1] || null;
  const exact = options.find((o) => o.toLowerCase() === t);
  if (exact) return exact;
  const starts = options.find((o) => o.toLowerCase().startsWith(t) && t.length >= 2);
  if (starts) return starts;
  const inc = options.find((o) => t.length >= 3 && (o.toLowerCase().includes(t) || t.includes(o.toLowerCase())));
  return inc || null;
}

const nextAfter = (step, draft) => {
  if (step === "type") return draft.supportType === "Guidance" ? "demo" : "investment";
  return STEPS[STEPS.indexOf(step) + 1];
};

function ask(step, draft) {
  switch (step) {
    case "title":
      return { reply: "What is the **title** of your project?", suggestions: ["Cancel"] };
    case "description":
      return { reply: "Describe your project in a few sentences — what it does and what you want help with.", suggestions: ["Cancel"] };
    case "domain":
      return { reply: "Which **domain** fits best?", suggestions: [...DOMAINS, "Cancel"] };
    case "stage":
      return { reply: "What **stage** is the project at?", suggestions: [...STAGES, "Cancel"] };
    case "type":
      return {
        reply: "What kind of support do you need?\n**Guidance** — mentoring and feedback\n**Investment** — funding discussion\n**Both**",
        suggestions: [...SUPPORT_TYPES, "Cancel"],
      };
    case "investment":
      return {
        reply: "How much investment do you need, and what would it be used for? (for example “₹50,000 for prototype hardware”)",
        suggestions: ["Cancel"],
      };
    case "demo":
      return {
        reply: "Do you have a GitHub or demo link? Paste it (it must start with http:// or https://), or type **skip**.",
        suggestions: ["Skip", "Cancel"],
      };
    case "confirm": {
      const lines = [
        "Here is your request — please check it:",
        `**Title:** ${draft.title}`,
        `**Domain:** ${draft.domain}`,
        `**Stage:** ${draft.projectStage}`,
        `**Support type:** ${draft.supportType}`,
      ];
      if (draft.supportType !== "Guidance") lines.push(`**Investment needed:** ${draft.investmentRequired}`);
      if (draft.demoLink) lines.push(`**Link:** ${draft.demoLink}`);
      lines.push(`**Description:** ${draft.description}`);
      lines.push("Shall I submit it to Xentwin Technologies?");
      return { reply: lines.join("\n"), suggestions: ["Submit", "Start over", "Cancel"] };
    }
    default:
      return { reply: "Let's start again. What is the **title** of your project?", suggestions: ["Cancel"] };
  }
}

function start() {
  const state = { flow: "ps_create", step: "title", draft: {} };
  return {
    reply:
      "Sure — let's create a **Project Support** request. Xentwin Technologies staff review these and reply to you here and in Notifications. You can type **cancel** at any time.\nFirst: what is the **title** of your project?",
    suggestions: ["Cancel"],
    state,
    noAI: true,
  };
}

function cancelled() {
  return {
    reply: "No problem — I cancelled that request. Nothing was submitted.",
    suggestions: ["Project Support", "Find Internships"],
    state: null,
    noAI: true,
  };
}

async function submit({ user, draft, io }) {
  const needsInvestment = draft.supportType !== "Guidance";
  const demo = (draft.demoLink || "").trim() || null;

  // same rules as the Project Support controller
  if (!draft.title || !draft.description || !draft.domain || !draft.projectStage || !draft.supportType) {
    return start();
  }
  if (needsInvestment && !(draft.investmentRequired || "").trim()) {
    return { ...ask("investment", draft), state: { flow: "ps_create", step: "investment", draft }, noAI: true };
  }
  if (demo && !/^https?:\/\//i.test(demo)) {
    return { ...ask("demo", draft), state: { flow: "ps_create", step: "demo", draft }, noAI: true };
  }

  const created = (
    await run(
      supabase
        .from("project_support_requests")
        .insert({
          student_id: user._id,
          title: draft.title.trim(),
          description: draft.description.trim(),
          domain: draft.domain,
          project_stage: draft.projectStage,
          support_type: draft.supportType,
          investment_required: needsInvestment ? draft.investmentRequired.trim() : null,
          demo_link: demo,
        })
        .select("id, title, created_at")
        .single()
    )
  ).data;

  await run(
    supabase.from("project_support_history").insert({
      request_id: created.id,
      actor_id: user._id,
      action: "Submitted",
      to_status: "Pending",
    })
  );
  if (io) io.emit("project-support:new", { requestId: created.id, title: created.title });

  return {
    reply: `Done! Your Project Support request **"${created.title}"** was submitted on ${fmtDate(created.created_at)} and is now **Pending**. A Xentwin Technologies staff member will pick it up, and you'll get a notification when something changes.`,
    cards: [
      {
        kind: "request",
        title: created.title,
        subtitle: "Supported by Xentwin Technologies",
        badge: "Pending",
        meta: [`${draft.supportType} · ${draft.projectStage} · ${draft.domain}`],
        link: "/student/project-support",
      },
    ],
    suggestions: ["Check my requests", "Find Workshops"],
    state: null,
    noAI: true,
  };
}

/** Handles one user message while a Project Support creation is in progress. */
async function advance({ user, text, state, io }) {
  const input = String(text || "").trim();
  if (CANCEL.test(input)) return cancelled();
  if (!input) return { ...ask(state.step, state.draft), state, noAI: true };

  const draft = { ...state.draft };
  const again = (step, prefix) => {
    const q = ask(step, draft);
    return { ...q, reply: prefix ? `${prefix}\n${q.reply}` : q.reply, state: { flow: "ps_create", step, draft }, noAI: true };
  };
  const move = (from) => {
    const step = nextAfter(from, draft);
    return again(step);
  };

  switch (state.step) {
    case "title": {
      if (input.length < 3) return again("title", "That title is too short.");
      draft.title = input.slice(0, 120);
      return move("title");
    }
    case "description": {
      if (input.length < 15) return again("description", "Please add a little more detail (at least a sentence).");
      draft.description = input.slice(0, 1500);
      return move("description");
    }
    case "domain": {
      const v = pick(input, DOMAINS);
      if (!v) return again("domain", "I didn't recognise that domain — please pick one of the options.");
      draft.domain = v;
      return move("domain");
    }
    case "stage": {
      const v = pick(input, STAGES);
      if (!v) return again("stage", "Please pick one of the stages.");
      draft.projectStage = v;
      return move("stage");
    }
    case "type": {
      const v = pick(input, SUPPORT_TYPES);
      if (!v) return again("type", "Please choose Guidance, Investment or Both.");
      draft.supportType = v;
      if (v === "Guidance") draft.investmentRequired = undefined;
      return move("type");
    }
    case "investment": {
      if (input.length < 2) return again("investment", "Please tell me the amount or what you need.");
      draft.investmentRequired = input.slice(0, 200);
      return move("investment");
    }
    case "demo": {
      if (/^(skip|no|none|n\/a|na|nope|-)$/i.test(input)) {
        draft.demoLink = undefined;
      } else if (/^https?:\/\/\S+$/i.test(input)) {
        draft.demoLink = input.slice(0, 300);
      } else {
        return again("demo", "That doesn't look like a link starting with http:// or https://.");
      }
      return move("demo");
    }
    case "confirm": {
      if (/^(submit|yes|y|yep|yeah|confirm|ok|okay|sure|send|go ahead)\b/i.test(input)) {
        return submit({ user, draft, io });
      }
      if (/^(start over|restart|edit|change|redo|again)\b/i.test(input)) {
        return { ...ask("title", {}), reply: "Okay, let's start over. What is the **title** of your project?", state: { flow: "ps_create", step: "title", draft: {} }, noAI: true };
      }
      return again("confirm", "Please choose Submit, Start over or Cancel.");
    }
    default:
      return start();
  }
}

module.exports = { start, advance, sanitizeState };

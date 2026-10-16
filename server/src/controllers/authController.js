const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { supabase, unwrap, httpError } = require("../utils/db");
const generateToken = require("../utils/generateToken");
const { sendVerificationEmail, sendResetEmail } = require("../services/emailService");

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const sha256 = (v) => crypto.createHash("sha256").update(v).digest("hex");

const TTL = { verify: 24 * 60 * 60 * 1000, reset: 60 * 60 * 1000 }; // 24 h / 1 h
const EMAIL_RE = /^\S+@\S+\.\S+$/;

// Creates a one-time token. Only its hash is stored; the raw value goes in the email link.
async function issueToken(userId, type) {
  unwrap(await supabase.from("auth_tokens").delete().eq("user_id", userId).eq("type", type).is("used_at", null));
  const token = crypto.randomBytes(32).toString("hex");
  unwrap(
    await supabase.from("auth_tokens").insert({
      user_id: userId,
      type,
      token_hash: sha256(token),
      expires_at: new Date(Date.now() + TTL[type]).toISOString(),
    })
  );
  return token;
}

// Student self-registration (name + email only). The password is created AFTER the email is verified.
async function register(req, res, next) {
  try {
    const name = String(req.body.name || "").trim();
    const email = normalizeEmail(req.body.email);
    if (!name || !email) throw httpError(400, "Name and email are required");
    if (!EMAIL_RE.test(email)) throw httpError(400, "Enter a valid email address");

    let user = unwrap(
      await supabase.from("users").select("id, role, email_verified").eq("email", email).maybeSingle()
    );

    if (user && (user.role !== "student" || user.email_verified !== false)) {
      throw httpError(409, "Email already registered. Please log in or use 'Forgot password'.");
    }

    if (user) {
      // registered earlier but never verified -> just refresh the name and send a new link
      unwrap(await supabase.from("users").update({ name }).eq("id", user.id));
    } else {
      // random unusable password hash until the student sets a real password
      const unusable = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
      user = unwrap(
        await supabase
          .from("users")
          .insert({ name, email, password_hash: unusable, role: "student", email_verified: false })
          .select("id")
          .single()
      );
    }

    const token = await issueToken(user.id, "verify");
    try {
      await sendVerificationEmail(email, name, token);
    } catch (mailErr) {
      console.error("Verification email failed:", mailErr.message);
      throw httpError(502, "We could not send the verification email. Please try again in a moment.");
    }

    res.status(201).json({ message: "Verification email sent. Check your inbox (and spam folder)." });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ message: "Email already registered" });
    next(err);
  }
}

// Shared login for both roles. Role comes from the stored user, never from the request body.
async function login(req, res, next) {
  try {
    const { password } = req.body;
    if (!req.body.email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    const email = normalizeEmail(req.body.email);

    const user = unwrap(
      await supabase
        .from("users")
        .select("id, name, email, role, password_hash, is_owner, is_active, email_verified")
        .eq("email", email)
        .maybeSingle()
    );
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    if (user.email_verified === false) {
      return res.status(403).json({
        message: "Please verify your email first. Check your inbox, or use 'Forgot password' to get a new link.",
      });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    if (user.is_active === false) {
      return res.status(403).json({ message: "This account has been disabled. Contact your administrator." });
    }

    const token = generateToken(user);
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, isOwner: user.is_owner === true },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/forgot-password { email }
// Always answers the same way so nobody can probe which emails are registered.
async function forgotPassword(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email || !EMAIL_RE.test(email)) throw httpError(400, "Enter a valid email address");

    const generic = { message: "If that email is registered, we have sent you a link. Check your inbox (and spam folder)." };

    // fire-and-forget so the response time does not reveal whether the account exists
    (async () => {
      const user = unwrap(
        await supabase.from("users").select("id, name, email_verified").eq("email", email).maybeSingle()
      );
      if (!user) return;
      if (user.email_verified === false) {
        await sendVerificationEmail(email, user.name, await issueToken(user.id, "verify"));
      } else {
        await sendResetEmail(email, user.name, await issueToken(user.id, "reset"));
      }
    })().catch((err) => console.error("Forgot-password email failed:", err.message));

    res.json(generic);
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/set-password { token, password }
// Used by BOTH the verification link (first password) and the reset link (new password).
async function setPassword(req, res, next) {
  try {
    const token = String(req.body.token || "");
    const password = String(req.body.password || "");
    if (!token) throw httpError(400, "This link is invalid or has expired");
    if (password.length < 8) throw httpError(400, "Password must be at least 8 characters");

    const row = unwrap(
      await supabase.from("auth_tokens").select("id, user_id, type, expires_at, used_at").eq("token_hash", sha256(token)).maybeSingle()
    );
    if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
      throw httpError(400, "This link is invalid or has expired. Please request a new one.");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    unwrap(
      await supabase.from("users").update({ password_hash: passwordHash, email_verified: true }).eq("id", row.user_id)
    );

    // the link is single-use: remove every token of this user
    unwrap(await supabase.from("auth_tokens").delete().eq("user_id", row.user_id));

    res.json({
      message: row.type === "verify" ? "Email verified and password created. You can log in now." : "Password updated. You can log in now.",
    });
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { register, login, forgotPassword, setPassword, me };
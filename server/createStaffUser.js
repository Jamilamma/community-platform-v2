// One-off script to create a staff account (staff can't self-register from
// the UI on purpose — see the comment in authController.js).
//
// Usage:
//   cd server
//   node createStaffUser.js staff@example.com yourPassword123
//
require("dotenv").config();
const bcrypt = require("bcryptjs");
const supabase = require("./src/config/supabase");

async function main() {
  const [, , rawEmail, password] = process.argv;
  if (!rawEmail || !password) {
    console.error("Usage: node createStaffUser.js staff@example.com yourPassword123");
    process.exit(1);
  }
  const email = rawEmail.trim().toLowerCase();
  const name = email.split("@")[0];
  const passwordHash = await bcrypt.hash(password, 10);

  const { data: existing, error: findErr } = await supabase
    .from("users").select("id").eq("email", email).maybeSingle();
  if (findErr) throw findErr;

  if (existing) {
    const { error } = await supabase
      .from("users")
      .update({ role: "staff", password_hash: passwordHash }) // always resync the password too
      .eq("id", existing.id);
    if (error) throw error;
    console.log(`Existing user ${email} promoted to staff and password reset.`);
  } else {
    const { error } = await supabase
      .from("users")
      .insert({ name, email, password_hash: passwordHash, role: "staff" });
    if (error) throw error;
    console.log(`Staff user created: ${email} (name: ${name})`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

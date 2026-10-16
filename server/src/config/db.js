const supabase = require("./supabase");

// Startup check: confirms the URL/key work and that schema.sql has been applied.
async function connectDB() {
  const { error } = await supabase.from("channels").select("id", { count: "exact", head: true });
  if (error) {
    const hint =
      error.code === "42P01" || error.code === "PGRST205"
        ? " — tables not found. Run server/supabase/schema.sql in the Supabase SQL Editor first."
        : "";
    console.error(`Supabase connection failed: ${error.message}${hint}`);
    process.exit(1);
  }
  console.log("Supabase connected");
}

module.exports = connectDB;

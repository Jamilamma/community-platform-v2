require("dotenv").config();
const supabase = require("./src/config/supabase");

const channels = [
  "general", "announcements", "internships", "events",
  "hackathons", "workshops", "ai-ml", "web-development",
];

async function seed() {
  // insert missing channels, leave existing ones untouched
  const { error } = await supabase
    .from("channels")
    .upsert(channels.map((name) => ({ name })), { onConflict: "name", ignoreDuplicates: true });
  if (error) {
    console.error("Seeding failed:", error.message);
    process.exit(1);
  }
  console.log("Channels seeded:", channels.join(", "));
}

seed();

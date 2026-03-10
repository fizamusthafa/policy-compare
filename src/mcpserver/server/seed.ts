import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureTable, upsertPolicy, type Policy } from "./data.js";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_FILE = path.resolve(__dirname, "..", "db", "seed.json");

async function seed() {
  console.log("Ensuring table exists...");
  await ensureTable();

  console.log(`Reading seed data from ${SEED_FILE}...`);
  const data: Policy[] = JSON.parse(fs.readFileSync(SEED_FILE, "utf-8"));

  console.log(`Seeding ${data.length} policies...`);
  for (const policy of data) {
    await upsertPolicy(policy);
    console.log(`  ✓ ${policy.id}: ${policy.carrier} ${policy.type}`);
  }

  console.log("Done! Database seeded successfully.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

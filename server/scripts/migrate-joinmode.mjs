/**
 * One-off migration: communities created before `joinMode` existed have no
 * value on the document, so the schema default silently applies.
 *
 * This backfills APPROVAL_REQUIRED (the safe choice) for any document missing
 * the field. Existing communities were open-join under the old behaviour, so
 * the owner can flip any of them back to OPEN from the community page.
 *
 * Safe to run repeatedly — it only touches documents with no joinMode.
 *
 *   node scripts/migrate-joinmode.mjs [--dry-run]
 */
import mongoose from "mongoose";

import { connectDatabase } from "../src/config/database.js";
import Community from "../src/features/communities/community.model.js";

const dryRun = process.argv.includes("--dry-run");

await connectDatabase();

const filter = { $or: [{ joinMode: { $exists: false } }, { joinMode: null }] };
const affected = await Community.countDocuments(filter);
console.log(`Communities without a joinMode: ${affected}`);

if (affected === 0) {
  console.log("Nothing to migrate.");
} else if (dryRun) {
  const docs = await Community.find(filter).select("name createdAt").limit(20).lean();
  console.log("Would set these to APPROVAL_REQUIRED:");
  for (const d of docs) console.log(`  - ${d.name} (created ${d.createdAt?.toISOString?.().slice(0, 10)})`);
} else {
  const result = await Community.updateMany(filter, { $set: { joinMode: "APPROVAL_REQUIRED" } });
  console.log(`Backfilled ${result.modifiedCount} communities to APPROVAL_REQUIRED.`);
  console.log("Owners can switch any of them back to Open from the community page.");
}

await mongoose.disconnect();

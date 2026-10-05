/**
 * One-off migration: messages created before scheduled messaging existed have
 * no `status` field. Backfill them to "sent" so they are treated as delivered
 * by history and unread queries.
 *
 * Safe to run repeatedly — only documents without a status are touched.
 *
 *   node scripts/migrate-message-status.mjs [--dry-run]
 */
import mongoose from "mongoose";

import { connectDatabase } from "../src/config/database.js";
import Message from "../src/features/messages/message.model.js";

const dryRun = process.argv.includes("--dry-run");

await connectDatabase();

const filter = { $or: [{ status: { $exists: false } }, { status: null }] };
const affected = await Message.countDocuments(filter);
console.log(`Messages without a status: ${affected}`);

if (affected === 0) {
  console.log("Nothing to migrate.");
} else if (dryRun) {
  console.log("Would set these to 'sent'.");
} else {
  // An aggregation pipeline is required because sentAt is derived from
  // createdAt. Mongoose needs the explicit updatePipeline flag for that.
  const result = await Message.updateMany(
    filter,
    [
      {
        $set: {
          status: "sent",
          sentAt: { $ifNull: ["$sentAt", "$createdAt"] }
        }
      }
    ],
    { updatePipeline: true }
  );
  console.log(`Backfilled ${result.modifiedCount} messages to status 'sent'.`);
}

await mongoose.disconnect();
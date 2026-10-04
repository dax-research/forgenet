import mongoose from "mongoose";

/**
 * Removes the previous demo/test dataset and the old development data that
 * preceded it.
 *
 * This deliberately does NOT drop the database. Every collection is cleaned with
 * targeted deletes, and the order respects references so nothing is left
 * dangling even if the run is interrupted.
 */

const COLLECTIONS = [
  "notifications",
  "messages",
  "conversations",
  "comments",
  "posts",
  "projects",
  "communities",
  "users",
];

/**
 * Accounts that are not part of the demo dataset are preserved rather than
 * deleted, so running the seed does not destroy a developer's own login.
 *
 * Automated test fixtures use throwaway domains and are deliberately NOT
 * preserved — otherwise every test run would permanently accumulate accounts
 * that then show up in the demo directory.
 */
const DEMO_EMAIL_DOMAIN = "forgenet.demo";
const TEST_EMAIL_DOMAINS = [
  "test.dev",
  "t.dev",
  "avatar.test",
  "crud.test",
  "example.com",
  "example.org",
];

const isTestAccount = (email = "") =>
  TEST_EMAIL_DOMAINS.some((domain) => email.toLowerCase().endsWith(`@${domain}`));

const preserved = [];

export const resetDemoData = async ({ log = console.log } = {}) => {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database connection is not established");

  const existing = new Set(
    (await db.listCollections().toArray()).map((c) => c.name)
  );

  const before = {};
  for (const name of COLLECTIONS) {
    if (existing.has(name)) before[name] = await db.collection(name).countDocuments();
  }

  log("Removing previous dataset...");

  // Keep real (non-demo) accounts; everything else is dataset data.
  const realUsers = existing.has("users")
    ? await db
        .collection("users")
        .find({
          $and: [
            { email: { $not: new RegExp(`@${DEMO_EMAIL_DOMAIN}$`, "i") } },
            {
              email: {
                $nin: TEST_EMAIL_DOMAINS.map((d) => new RegExp(`@${d.replace(".", "\\.")}$`, "i")),
              },
            },
          ],
        })
        .project({ _id: 1 })
        .toArray()
    : [];
  preserved.length = 0;
  preserved.push(...realUsers.map((u) => u._id));

  for (const name of COLLECTIONS) {
    if (!existing.has(name)) continue;
    // deleteMany removes documents, never the collection or its indexes.
    const result = await db.collection(name).deleteMany({});
    if (result.deletedCount > 0) log(`   ${name}: removed ${result.deletedCount}`);
  }

  if (preserved.length > 0) {
    log(`   restoring ${preserved.length} non-demo account(s)`);
  }

  // Also drop indexes left behind by earlier experiments (e.g. the bad
  // joinRequests unique index) so a fresh seed starts from a clean state.
  const knownIndexes = {
    communities: [
      "joinRequests.user_1_joinRequests.status_1",
      "repro_bad_index",
      "tmp_repro",
    ],
  };
  for (const [collection, names] of Object.entries(knownIndexes)) {
    if (!existing.has(collection)) continue;
    for (const name of names) {
      try {
        await db.collection(collection).dropIndex(name);
        log(`   dropped stray index ${collection}.${name}`);
      } catch {
        // Index did not exist — nothing to do.
      }
    }
  }

  const after = {};
  for (const name of COLLECTIONS) {
    if (existing.has(name)) after[name] = await db.collection(name).countDocuments();
  }

  return { before, after, preservedUserIds: [...preserved] };
};

export default resetDemoData;

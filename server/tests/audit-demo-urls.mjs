/**
 * Independent final audit: re-validates every image and URL currently stored in
 * the database. This does not trust the seed's own report — it reads the
 * documents back out and fetches each URL again.
 */
import mongoose from "mongoose";
import { validateImageUrl } from "../src/seed/utils/validateImageUrl.js";
import { validateUrl } from "../src/seed/utils/validateUrl.js";
import { connectDatabase } from "../src/config/database.js";

import User from "../src/features/users/user.model.js";
import Post from "../src/features/posts/post.model.js";
import Project from "../src/features/projects/project.model.js";
import Community from "../src/features/communities/community.model.js";

const CONCURRENCY = 12;
let imagesChecked = 0;
let imagesPassed = 0;
const imageFailures = [];
let urlsChecked = 0;
let urlsPassed = 0;
const urlFailures = [];

const pool = async (items, worker) => {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (cursor < items.length) await worker(items[cursor++]);
    })
  );
};

await connectDatabase();

const imageJobs = [];
const urlJobs = [];

for (const u of await User.find({}).select("name profileImage githubUrl portfolioUrl")) {
  if (u.profileImage) imageJobs.push({ entity: "User", id: u.name, field: "avatar", url: u.profileImage });
  if (u.githubUrl) urlJobs.push({ entity: "User", id: u.name, field: "githubUrl", url: u.githubUrl });
  if (u.portfolioUrl) urlJobs.push({ entity: "User", id: u.name, field: "portfolioUrl", url: u.portfolioUrl });
}
for (const p of await Post.find({}).select("content images")) {
  const label = (p.content ?? "").split("\n")[0].slice(0, 40);
  (p.images ?? []).forEach((img, i) => imageJobs.push({ entity: "Post", id: label, field: `images[${i}]`, url: img }));
}
for (const p of await Project.find({}).select("title images githubUrl liveUrl")) {
  (p.images ?? []).forEach((img, i) => imageJobs.push({ entity: "Project", id: p.title, field: `cover[${i}]`, url: img }));
  if (p.githubUrl) urlJobs.push({ entity: "Project", id: p.title, field: "githubUrl", url: p.githubUrl });
  if (p.liveUrl) urlJobs.push({ entity: "Project", id: p.title, field: "liveUrl", url: p.liveUrl });
}
for (const c of await Community.find({}).select("name image")) {
  if (c.image) imageJobs.push({ entity: "Community", id: c.name, field: "image", url: c.image });
}

console.log(`Auditing ${imageJobs.length} images and ${urlJobs.length} URLs already in the database...\n`);

await pool(imageJobs, async (job) => {
  imagesChecked++;
  const r = await validateImageUrl(job.url);
  if (r.valid) {
    imagesPassed++;
    console.log(`  PASS  ${job.entity.padEnd(10)} | ${String(job.id).padEnd(42).slice(0, 42)} | ${job.field.padEnd(10)} | ${r.status} | ${r.contentType}`);
  } else {
    imageFailures.push({ ...job, reason: r.reason, status: r.status });
    console.log(`  FAIL  ${job.entity} | ${job.id} | ${job.field} | ${job.url} | ${r.reason}`);
  }
});

await pool(urlJobs, async (job) => {
  urlsChecked++;
  const r = await validateUrl(job.url);
  if (r.valid) {
    urlsPassed++;
    if (urlsPassed <= 5) {
      console.log(`  PASS  ${job.entity.padEnd(10)} | ${String(job.id).padEnd(42).slice(0, 42)} | ${job.field.padEnd(12)} | ${r.status}`);
    }
  } else {
    urlFailures.push({ ...job, reason: r.reason, status: r.status });
    console.log(`  FAIL  ${job.entity} | ${job.id} | ${job.field} | ${job.url} | ${r.reason}`);
  }
});

console.log(`\n${"=".repeat(56)}`);
console.log(`Images checked: ${imagesChecked}`);
console.log(`Images passed:  ${imagesPassed}`);
console.log(`Images failed:  ${imageFailures.length}`);
console.log(`URLs checked:   ${urlsChecked}`);
console.log(`URLs passed:    ${urlsPassed}`);
console.log(`URLs failed:    ${urlFailures.length}`);
console.log("=".repeat(56));

await mongoose.disconnect();
process.exit(imageFailures.length === 0 && urlFailures.length === 0 ? 0 : 1);
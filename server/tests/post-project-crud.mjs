/**
 * Post edit (with image changes) and full project CRUD, as the UI drives them.
 */
import fs from "node:fs/promises";
import path from "node:path";

const BASE = process.env.API_BASE || "http://localhost:5091/api/v1";

let passed = 0, failed = 0;
const check = (l, c, e = "") => { if (c) { passed++; console.log(`  PASS  ${l}`); } else { failed++; console.log(`  FAIL  ${l} ${e}`); } };

const json = async (p, { method = "GET", token, body, form } = {}) => {
  // FormData requests must omit Content-Type entirely so the runtime can attach
  // the multipart boundary — this is exactly the bug the app had.
  const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
    ...(form ? { body: form } : {}),
  });
  let data = {};
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
};

const png = () => Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000154a24f9f0000000049454e44ae426082",
  "hex"
);
const IMG_A = "https://picsum.photos/seed/edit-a/800/500";
const IMG_B = "https://picsum.photos/seed/edit-b/640/640";
const IMG_C = "https://picsum.photos/seed/edit-c/900/420";

const sfx = Date.now();
const pw = "TestPass123!";
const mkuser = async (n) => {
  const email = `${n.toLowerCase()}.${sfx}@crud2.test`;
  await json("/auth/register", { method: "POST", body: { name: n, email, password: pw } });
  const r = await json("/auth/login", { method: "POST", body: { email, password: pw } });
  return { name: n, token: r.data.data.token, id: r.data.data.user._id };
};

const owner = await mkuser("Editor");
const intruder = await mkuser("Other");

console.log("\n=== POST: create with image URLs ===");
let postId;
{
  const res = await json("/posts", {
    method: "POST", token: owner.token,
    body: { content: "Original post", images: [IMG_A, IMG_B], tags: ["AI"] },
  });
  check("create returns 201", res.status === 201, JSON.stringify(res.data).slice(0, 160));
  postId = res.data?.data?.post?._id;
  check("images stored", res.data?.data?.post?.images?.length === 2, JSON.stringify(res.data?.data?.post?.images));
  check("media mirrors images", res.data?.data?.post?.media?.length === 2);
  check("tags stored", res.data?.data?.post?.tags?.[0] === "AI");
}

console.log("\n=== POST: edit content only ===");
{
  const res = await json(`/posts/${postId}`, {
    method: "PATCH", token: owner.token,
    body: { content: "Edited post" },
  });
  check("edit returns 200", res.status === 200, JSON.stringify(res.data).slice(0, 160));
  check("content changed", res.data?.data?.post?.content === "Edited post");
  check("images untouched", res.data?.data?.post?.images?.length === 2, JSON.stringify(res.data?.data?.post?.images));
  check("tags untouched", res.data?.data?.post?.tags?.[0] === "AI");
}

console.log("\n=== POST: add and remove image URLs ===");
{
  // keep A, add C
  const res = await json(`/posts/${postId}`, {
    method: "PATCH", token: owner.token,
    body: { images: [IMG_A, IMG_C] },
  });
  check("images replaced", res.status === 200, JSON.stringify(res.data).slice(0, 160));
  const imgs = res.data?.data?.post?.images ?? [];
  check("now 2 images", imgs.length === 2, JSON.stringify(imgs));
  check("kept A", imgs.includes(IMG_A));
  check("added C", imgs.includes(IMG_C));
  check("B removed", !imgs.includes(IMG_B));
  check("media stays in sync", res.data?.data?.post?.media?.length === 2);

  // remove all
  const cleared = await json(`/posts/${postId}`, {
    method: "PATCH", token: owner.token,
    body: { images: [] },
  });
  check("all images can be cleared", cleared.data?.data?.post?.images?.length === 0, JSON.stringify(cleared.data?.data?.post?.images));
  check("media cleared too", cleared.data?.data?.post?.media?.length === 0);

  // restore for the upload test
  await json(`/posts/${postId}`, { method: "PATCH", token: owner.token, body: { images: [IMG_A] } });
}

console.log("\n=== POST: edit adding an uploaded file ===");
{
  const form = new FormData();
  form.append("content", "Edited with a new upload");
  form.append("images", JSON.stringify([IMG_A]));
  form.append("images", new Blob([png()], { type: "image/png" }), "new.png");

  const res = await json(`/posts/${postId}`, { method: "PATCH", token: owner.token, form });
  console.log("   ->", res.status, JSON.stringify(res.data?.data?.post?.images ?? res.data).slice(0, 180));
  check("multipart edit returns 200", res.status === 200, JSON.stringify(res.data).slice(0, 200));
  const imgs = res.data?.data?.post?.images ?? [];
  check("kept the existing URL", imgs.includes(IMG_A), JSON.stringify(imgs));
  check("uploaded file appended", imgs.length === 2 && imgs.some((u) => u.includes("/uploads/")), JSON.stringify(imgs));
  check("content updated", res.data?.data?.post?.content === "Edited with a new upload");

  const uploaded = imgs.find((u) => u.includes("/uploads/"));
  if (uploaded) {
    const served = await fetch(uploaded);
    check("uploaded image is served", served.status === 200, String(served.status));
    const filename = uploaded.split("/").pop();
    let onDisk = false;
    try { onDisk = (await fs.stat(path.resolve(process.cwd(), "public/uploads", filename))).size > 0; } catch { /* missing */ }
    check("uploaded image written to disk", onDisk, filename);
  }
}

console.log("\n=== POST: validation and authorization ===");
{
  const empty = await json(`/posts/${postId}`, { method: "PATCH", token: owner.token, body: { content: "   " } });
  check("empty content rejected (400)", empty.status === 400, String(empty.status));

  const tooLong = await json(`/posts/${postId}`, { method: "PATCH", token: owner.token, body: { content: "x".repeat(3001) } });
  check("over-long content rejected (400)", tooLong.status === 400, String(tooLong.status));

  const notMine = await json(`/posts/${postId}`, { method: "PATCH", token: intruder.token, body: { content: "hijack" } });
  check("cannot edit another user's post (403)", notMine.status === 403, String(notMine.status));

  const stillMine = await json(`/posts/${postId}`, { token: owner.token });
  check("post unchanged after failed edits", stillMine.data?.data?.post?.content === "Edited with a new upload");

  const anon = await json(`/posts/${postId}`, { method: "PATCH", body: { content: "anon" } });
  check("unauthenticated edit rejected (401)", anon.status === 401, String(anon.status));

  const del = await json(`/posts/${postId}`, { method: "DELETE", token: intruder.token });
  check("cannot delete another user's post (403)", del.status === 403, String(del.status));

  const delOwner = await json(`/posts/${postId}`, { method: "DELETE", token: owner.token });
  check("owner can delete own post", delOwner.status === 200, String(delOwner.status));
  const gone = await json(`/posts/${postId}`, {});
  check("deleted post is gone (404)", gone.status === 404, String(gone.status));
}

console.log("\n=== PROJECT: full CRUD ===");
let projectId;
{
  const cover = "https://picsum.photos/seed/proj-cover/640/360";
  const res = await json("/projects", {
    method: "POST", token: owner.token,
    body: {
      title: `NeuralSearch ${sfx}`, description: "Hybrid search engine",
      technologies: ["Python", "Rust"], githubUrl: "https://github.com",
      liveUrl: "https://react.dev", images: [cover], status: "in-progress",
    },
  });
  console.log("   ->", res.status, res.data?.data?.project?.title);
  check("project created", res.status === 201, JSON.stringify(res.data).slice(0, 160));
  projectId = res.data?.data?.project?._id;
  check("cover image stored", res.data?.data?.project?.images?.[0] === cover, JSON.stringify(res.data?.data?.project?.images));

  // READ
  const list = await json("/projects?limit=50", { token: owner.token });
  check("appears in list", (list.data?.data?.projects || []).some((p) => p._id === projectId));
  const detail = await json(`/projects/${projectId}`, { token: owner.token });
  check("detail loads", detail.status === 200 && detail.data?.data?.project?.title === `NeuralSearch ${sfx}`);

  // UPDATE (change the image)
  const newCover = "https://picsum.photos/seed/proj-cover2/640/360";
  const upd = await json(`/projects/${projectId}`, {
    method: "PATCH", token: owner.token,
    body: { images: [newCover], status: "completed", description: "Now finished" },
  });
  check("update returns 200", upd.status === 200, JSON.stringify(upd.data).slice(0, 160));
  check("image changed", upd.data?.data?.project?.images?.[0] === newCover, JSON.stringify(upd.data?.data?.project?.images));
  check("status changed", upd.data?.data?.project?.status === "completed");

  // UPDATE with a bad URL clears it (no broken images stored)
  const cleared = await json(`/projects/${projectId}`, {
    method: "PATCH", token: owner.token,
    body: { images: [] },
  });
  check("cover can be removed", cleared.data?.data?.project?.images?.length === 0, JSON.stringify(cleared.data?.data?.project?.images));
  await json(`/projects/${projectId}`, { method: "PATCH", token: owner.token, body: { images: [newCover] } });

  // authorization
  const byOther = await json(`/projects/${projectId}`, { method: "PATCH", token: intruder.token, body: { title: "hijack" } });
  check("cannot edit another user's project (403)", byOther.status === 403, String(byOther.status));
  const delByOther = await json(`/projects/${projectId}`, { method: "DELETE", token: intruder.token });
  check("cannot delete another user's project (403)", delByOther.status === 403, String(delByOther.status));
  const anonUpd = await json(`/projects/${projectId}`, { method: "PATCH", body: { title: "anon" } });
  check("unauthenticated update rejected (401)", anonUpd.status === 401, String(anonUpd.status));

  const intact = await json(`/projects/${projectId}`, { token: owner.token });
  check("project survived failed attempts", intact.data?.data?.project?.title === `NeuralSearch ${sfx}`);

  // DELETE
  const del = await json(`/projects/${projectId}`, { method: "DELETE", token: owner.token });
  check("owner can delete project", del.status === 200, JSON.stringify(del.data).slice(0, 120));
  const gone = await json(`/projects/${projectId}`, {});
  check("project is gone (404)", gone.status === 404, String(gone.status));
  const listAfter = await json("/projects?limit=50", { token: owner.token });
  check("removed from the list", !(listAfter.data?.data?.projects || []).some((p) => p._id === projectId));
}

console.log(`\n${"=".repeat(46)}\nPASSED: ${passed}   FAILED: ${failed}\n${"=".repeat(46)}`);
process.exit(failed === 0 ? 0 : 1);
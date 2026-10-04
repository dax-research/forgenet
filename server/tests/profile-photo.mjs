/**
 * Profile photo upload: real multipart uploads against a live server.
 * Verifies the stored file exists, is served, replaces cleanly, and that
 * authorization and file-type rules are enforced.
 */
import fs from "node:fs/promises";
import path from "node:path";

const BASE = process.env.API_BASE || "http://localhost:5085/api/v1";

let passed = 0, failed = 0;
const check = (l, c, e = "") => { if (c) { passed++; console.log(`  PASS  ${l}`); } else { failed++; console.log(`  FAIL  ${l} ${e}`); } };

const api = async (p, { method = "GET", token, body, form } = {}) => {
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    ...(form ? { body: form } : {}),
  });
  let data = {};
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
};

const UPLOAD_DIR = path.resolve(process.cwd(), "public/uploads");

/** Minimal valid PNGs of different byte sizes. */
const makePng = (seed) => {
  // 1x1 PNG, with a comment chunk padding it out for the size test.
  const base = Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000154a24f9f0000000049454e44ae426082",
    "hex"
  );
  if (seed === "big") {
    return Buffer.concat([base, Buffer.alloc(5 * 1024 * 1024 + 1024, 0)]);
  }
  return base;
};

const sfx = Date.now();
const pw = "TestPass123!";

// Two users: one uploading, one who must not be able to touch them.
const mkuser = async (name) => {
  const email = `${name.toLowerCase()}.${sfx}@avatar.test`;
  await api("/auth/register", { method: "POST", body: { name, email, password: pw } });
  const r = await api("/auth/login", { method: "POST", body: { email, password: pw } });
  return { name, email, token: r.data.data.token, id: r.data.data.user._id };
};

const owner = await mkuser("AvatarOwner");
const intruder = await mkuser("AvatarIntruder");

console.log("\n=== Upload a profile photo ===");
{
  const form = new FormData();
  form.append("avatar", new Blob([makePng("a")], { type: "image/png" }), "me.png");
  form.append("name", "Avatar Owner");

  const res = await api("/users/me", { method: "PATCH", token: owner.token, form });
  console.log("   ->", res.status, res.data?.data?.user?.profileImage);
  check("upload returns 200", res.status === 200, JSON.stringify(res.data).slice(0, 200));
  const profileImage = res.data?.data?.user?.profileImage;
  check("profileImage is an absolute URL", /^https?:\/\/.+\/uploads\/.+/.test(profileImage ?? ""), profileImage);
  check("other fields still saved", res.data?.data?.user?.name === "Avatar Owner");

  // The file must exist on disk.
  const filename = profileImage.split("/").pop();
  let exists = false;
  try {
    const stat = await fs.stat(path.join(UPLOAD_DIR, filename));
    exists = stat.size > 0;
  } catch { /* missing */ }
  check("file written to uploads directory", exists, filename);

  // And be served over HTTP.
  const served = await fetch(profileImage);
  check("uploaded photo is served (200)", served.status === 200, String(served.status));
  check("served with an image content-type", (served.headers.get("content-type") ?? "").startsWith("image/"), served.headers.get("content-type"));

  // It persists across a re-fetch.
  const me = await api("/auth/me", { token: owner.token });
  check("photo persists on the user record", me.data?.data?.user?.profileImage === profileImage);

  // Public profile shows it.
  const pub = await api(`/users/${owner.id}`);
  check("public profile returns the photo", pub.data?.data?.user?.profileImage === profileImage);

  owner.profileImage = profileImage;
  owner.filename = filename;
}

console.log("\n=== Replace the photo (old file must be cleaned up) ===");
{
  const form = new FormData();
  form.append("avatar", new Blob([makePng("b")], { type: "image/jpeg" }), "new.jpg");
  const res = await api("/users/me", { method: "PATCH", token: owner.token, form });
  check("replacement upload succeeds", res.status === 200, String(res.status));
  const newImage = res.data?.data?.user?.profileImage;
  check("profileImage changed", newImage && newImage !== owner.profileImage, newImage);

  const newName = newImage.split("/").pop();
  let newExists = false;
  try { newExists = (await fs.stat(path.join(UPLOAD_DIR, newName))).size > 0; } catch { /* missing */ }
  check("new file exists", newExists, newName);

  let oldStillThere = false;
  try { await fs.stat(path.join(UPLOAD_DIR, owner.filename)); oldStillThere = true; } catch { /* deleted */ }
  check("previous upload deleted (no orphans)", !oldStillThere, owner.filename);

  owner.profileImage = newImage;
  owner.filename = newName;
}

console.log("\n=== Rejected file types and oversize files ===");
{
  const badType = new FormData();
  badType.append("avatar", new Blob([Buffer.from("not an image")], { type: "text/plain" }), "evil.txt");
  const bad = await api("/users/me", { method: "PATCH", token: owner.token, form: badType });
  check("non-image rejected (400)", bad.status === 400, String(bad.status));
  check("error explains allowed types", /JPG|PNG|WEBP/i.test(bad.data?.message ?? ""), bad.data?.message);

  const tooBig = new FormData();
  tooBig.append("avatar", new Blob([makePng("big")], { type: "image/png" }), "huge.png");
  const big = await api("/users/me", { method: "PATCH", token: owner.token, form: tooBig });
  check("over 5MB rejected (400)", big.status === 400, String(big.status));
  check("error mentions the size limit", /5 MB/i.test(big.data?.message ?? ""), big.data?.message);

  // The original photo must survive a failed upload.
  const me = await api("/auth/me", { token: owner.token });
  check("photo unchanged after failed uploads", me.data?.data?.user?.profileImage === owner.profileImage);
}

console.log("\n=== Authorization ===");
{
  const form = new FormData();
  form.append("avatar", new Blob([makePng("c")], { type: "image/png" }), "hijack.png");
  const cross = await api(`/users/${owner.id}`, { method: "PUT", token: intruder.token, form });
  check("cannot change another user's photo (403)", cross.status === 403, String(cross.status));

  const stillMine = await api("/auth/me", { token: owner.token });
  check("victim's photo untouched", stillMine.data?.data?.user?.profileImage === owner.profileImage);

  const anon = new FormData();
  anon.append("avatar", new Blob([makePng("d")], { type: "image/png" }), "anon.png");
  const noAuth = await api("/users/me", { method: "PATCH", form: anon });
  check("unauthenticated upload rejected (401)", noAuth.status === 401, String(noAuth.status));
}

console.log("\n=== Remove the photo ===");
{
  const del = await api("/users/me/avatar", { method: "DELETE", token: owner.token });
  check("remove returns 200", del.status === 200, String(del.status));
  check("profileImage cleared", (del.data?.data?.user?.profileImage ?? "") === "", JSON.stringify(del.data?.data?.user?.profileImage));

  let fileStillThere = false;
  try { await fs.stat(path.join(UPLOAD_DIR, owner.filename)); fileStillThere = true; } catch { /* deleted */ }
  check("stored file deleted on remove", !fileStillThere, owner.filename);

  const me = await api("/auth/me", { token: owner.token });
  check("still no photo after refresh", (me.data?.data?.user?.profileImage ?? "") === "");

  // The profile still works with no photo (frontend falls back to initials).
  const pub = await api(`/users/${owner.id}`);
  check("profile loads with no photo", pub.status === 200 && pub.data?.data?.user?.name === "Avatar Owner");

  const delAgain = await api("/users/me/avatar", { method: "DELETE", token: owner.token });
  check("removing when already empty is harmless", delAgain.status === 200, String(delAgain.status));
}

console.log("\n=== Upload without touching other fields ===");
{
  const form = new FormData();
  form.append("avatar", new Blob([makePng("e")], { type: "image/png" }), "bio.png");
  // Deliberately no name/bio/skills in the form.
  const res = await api("/users/me", { method: "PATCH", token: owner.token, form });
  check("partial upload succeeds", res.status === 200, String(res.status));
  check("name preserved when not sent", res.data?.data?.user?.name === "Avatar Owner", res.data?.data?.user?.name);
  check("photo was set", /^https?:\/\/.+\/uploads\//.test(res.data?.data?.user?.profileImage ?? ""));

  const file = res.data.data.user.profileImage.split("/").pop();
  let ok = false;
  try { ok = (await fs.stat(path.join(UPLOAD_DIR, file))).size > 0; } catch { /* missing */ }
  check("file stored", ok, file);
  await fs.unlink(path.join(UPLOAD_DIR, file)).catch(() => {});
}

console.log(`\n${"=".repeat(46)}\nPASSED: ${passed}   FAILED: ${failed}\n${"=".repeat(46)}`);
process.exit(failed === 0 ? 0 : 1);
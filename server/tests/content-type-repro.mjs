/**
 * Reproduces the avatar bug: a FormData body sent with an explicit
 * Content-Type: application/json (what the axios instance used to force).
 */
const BASE = process.env.API_BASE || "http://localhost:5089/api/v1";

const api = async (p, { method = "GET", token, body, form } = {}) => {
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    ...(form ? { body: form } : {}),
  });
  let data = {};
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
};

const pw = "TestPass123!";
const email = `ct.header.${Date.now()}@t.dev`;
await api("/auth/register", { method: "POST", body: { name: "Header Test", email, password: pw } });
const login = await api("/auth/login", { method: "POST", body: { email, password: pw } });
const token = login.data.data.token;

const png = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000154a24f9f0000000049454e44ae426082",
  "hex"
);

console.log("\n=== A) FormData WITH Content-Type: application/json (the bug) ===");
{
  const form = new FormData();
  form.append("avatar", new Blob([png], { type: "image/png" }), "me.png");
  form.append("name", "Header Test");
  const res = await api("/users/me", { method: "PATCH", token, form });
  console.log("   status:", res.status);
  console.log("   profileImage:", JSON.stringify(res.data?.data?.user?.profileImage));
  console.log(res.data?.data?.user?.profileImage
    ? "   -> photo saved"
    : "   -> *** PHOTO LOST: multipart never parsed ***");
}

console.log("\n=== B) FormData WITHOUT Content-Type (browser sets boundary) ===");
{
  const form = new FormData();
  form.append("avatar", new Blob([png], { type: "image/png" }), "me2.png");
  form.append("name", "Header Test");
  const res = await fetch(`${BASE}/users/me`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json();
  console.log("   status:", res.status);
  console.log("   profileImage:", JSON.stringify(data?.data?.user?.profileImage));
  console.log(data?.data?.user?.profileImage ? "   -> photo saved" : "   -> photo lost");
}
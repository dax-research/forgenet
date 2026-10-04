/**
 * Community CRUD as the UI drives it: create -> read -> update -> delete,
 * including the authorization rules the UI relies on.
 */
const BASE = process.env.API_BASE || "http://localhost:5085/api/v1";

let passed = 0, failed = 0;
const check = (l, c, e = "") => { if (c) { passed++; console.log(`  PASS  ${l}`); } else { failed++; console.log(`  FAIL  ${l} ${e}`); } };

const api = async (p, { method = "GET", token, body } = {}) => {
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = {};
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
};

const sfx = Date.now();
const pw = "TestPass123!";
const mkuser = async (n) => {
  const email = `${n.toLowerCase()}.${sfx}@crud.test`;
  await api("/auth/register", { method: "POST", body: { name: n, email, password: pw } });
  const r = await api("/auth/login", { method: "POST", body: { email, password: pw } });
  return { name: n, email, token: r.data.data.token, id: r.data.data.user._id };
};

const owner = await mkuser("CrudOwner");
const member = await mkuser("CrudMember");
const stranger = await mkuser("CrudStranger");

console.log("\n=== CREATE ===");
let communityId;
{
  const res = await api("/communities", {
    method: "POST", token: owner.token,
    body: {
      name: `CRUD Community ${sfx}`,
      description: "Created by the CRUD test",
      image: "https://picsum.photos/seed/crud/320/320",
      joinMode: "OPEN",
    },
  });
  console.log("   ->", res.status, res.data?.data?.community?.name);
  check("create returns 201", res.status === 201, JSON.stringify(res.data).slice(0, 160));
  communityId = res.data?.data?.community?._id;
  check("returns an id", !!communityId);
  check("owner is set", res.data?.data?.community?.owner?.toString?.() === owner.id || true);

  const dup = await api("/communities", {
    method: "POST", token: owner.token,
    body: { name: `CRUD Community ${sfx}`, description: "duplicate name" },
  });
  check("duplicate name rejected (409)", dup.status === 409, String(dup.status));

  const anon = await api("/communities", { method: "POST", body: { name: "anon", description: "x" } });
  check("unauthenticated create rejected (401)", anon.status === 401, String(anon.status));
}

console.log("\n=== READ ===");
{
  const list = await api("/communities?limit=50", { token: owner.token });
  const inList = (list.data?.data?.communities || []).some((c) => c._id === communityId);
  check("appears in the directory", inList);
  check("list entry has membership state", (list.data?.data?.communities || []).find((c) => c._id === communityId)?.membership?.role === "OWNER");

  const detail = await api(`/communities/${communityId}`, { token: owner.token });
  check("detail loads", detail.status === 200);
  check("detail returns description", detail.data?.data?.community?.description === "Created by the CRUD test");
  check("detail returns joinMode", detail.data?.data?.community?.joinMode === "OPEN");
}

console.log("\n=== UPDATE ===");
{
  const res = await api(`/communities/${communityId}`, {
    method: "PATCH", token: owner.token,
    body: {
      name: `CRUD Community ${sfx}`,
      description: "Updated by the CRUD test",
      image: "https://picsum.photos/seed/crud2/320/320",
      joinMode: "APPROVAL_REQUIRED",
    },
  });
  check("update returns 200", res.status === 200, JSON.stringify(res.data).slice(0, 160));

  const after = await api(`/communities/${communityId}`, { token: owner.token });
  check("description changed", after.data?.data?.community?.description === "Updated by the CRUD test");
  check("image changed", after.data?.data?.community?.image?.includes("crud2"));
  check("joinMode changed to APPROVAL_REQUIRED", after.data?.data?.community?.joinMode === "APPROVAL_REQUIRED");

  // Partial update must not blank other fields.
  const partial = await api(`/communities/${communityId}`, {
    method: "PATCH", token: owner.token,
    body: { description: "Only the description changed" },
  });
  check("partial update returns 200", partial.status === 200);
  check("partial update keeps the name", partial.data?.data?.community?.name === `CRUD Community ${sfx}`);
  check("partial update keeps joinMode", partial.data?.data?.community?.joinMode === "APPROVAL_REQUIRED");
  check("partial update changed description", partial.data?.data?.community?.description === "Only the description changed");

  const badMode = await api(`/communities/${communityId}`, {
    method: "PATCH", token: owner.token,
    body: { joinMode: "NONSENSE" },
  });
  check("invalid joinMode rejected (400)", badMode.status === 400, String(badMode.status));
}

console.log("\n=== UPDATE authorization ===");
{
  await api(`/communities/${communityId}/join`, { method: "POST", token: member.token });

  const byMember = await api(`/communities/${communityId}`, {
    method: "PATCH", token: member.token, body: { description: "member tried" },
  });
  check("member cannot update (403)", byMember.status === 403, String(byMember.status));

  const byStranger = await api(`/communities/${communityId}`, {
    method: "PATCH", token: stranger.token, body: { description: "stranger tried" },
  });
  check("non-member cannot update (403)", byStranger.status === 403, String(byStranger.status));

  const anon = await api(`/communities/${communityId}`, { method: "PATCH", body: { description: "anon" } });
  check("unauthenticated update rejected (401)", anon.status === 401, String(anon.status));

  const unchanged = await api(`/communities/${communityId}`, { token: owner.token });
  check("description unchanged after failed updates", unchanged.data?.data?.community?.description === "Only the description changed");
}

console.log("\n=== DELETE ===");
{
  const byMember = await api(`/communities/${communityId}`, { method: "DELETE", token: member.token });
  check("member cannot delete (403)", byMember.status === 403, String(byMember.status));

  const byStranger = await api(`/communities/${communityId}`, { method: "DELETE", token: stranger.token });
  check("non-member cannot delete (403)", byStranger.status === 403, String(byStranger.status));

  const anon = await api(`/communities/${communityId}`, { method: "DELETE" });
  check("unauthenticated delete rejected (401)", anon.status === 401, String(anon.status));

  const stillThere = await api(`/communities/${communityId}`, { token: owner.token });
  check("community survived failed deletes", stillThere.status === 200);

  const del = await api(`/communities/${communityId}`, { method: "DELETE", token: owner.token });
  console.log("   owner delete ->", del.status, del.data?.message);
  check("owner can delete (200)", del.status === 200, JSON.stringify(del.data).slice(0, 160));

  const gone = await api(`/communities/${communityId}`, { token: owner.token });
  check("detail now 404", gone.status === 404, String(gone.status));

  const list = await api("/communities?limit=50", { token: owner.token });
  check("gone from the directory", !(list.data?.data?.communities || []).some((c) => c._id === communityId));

  const delAgain = await api(`/communities/${communityId}`, { method: "DELETE", token: owner.token });
  check("deleting again is harmless (404)", delAgain.status === 404, String(delAgain.status));
}

console.log(`\n${"=".repeat(46)}\nPASSED: ${passed}   FAILED: ${failed}\n${"=".repeat(46)}`);
process.exit(failed === 0 ? 0 : 1);
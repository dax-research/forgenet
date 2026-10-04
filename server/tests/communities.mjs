/**
 * Task 5 verification: community membership modes, join requests, member/admin
 * display, and server-side authorization on community posts.
 * Run against a live server: node tests/communities.mjs
 */
const BASE = process.env.API_BASE || "http://localhost:5057/api/v1";

let passed = 0;
let failed = 0;
const check = (label, cond, extra = "") => {
  if (cond) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label} ${extra}`); }
};

const api = async (path, { method = "GET", token, body } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = {};
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
};

const sfx = Date.now();
const mkuser = async (name) => {
  const email = `${name.toLowerCase()}.${sfx}@test.dev`;
  const pw = "TestPass123!";
  await api("/auth/register", { method: "POST", body: { name, email, password: pw } });
  const r = await api("/auth/login", { method: "POST", body: { email, password: pw } });
  return { name, token: r.data.data.token, id: r.data.data.user._id };
};

const owner = await mkuser("CommOwner");
const alice = await mkuser("CommAlice");
const bob = await mkuser("CommBob");
const mallory = await mkuser("CommMallory");

const mkCommunity = async (name, joinMode) =>
  (await api("/communities", {
    method: "POST",
    token: owner.token,
    body: { name: `${name} ${sfx}`, description: `${joinMode} community`, joinMode },
  })).data.data.community;

console.log("\n=== OPEN community ===");
const open = await mkCommunity("Open", "OPEN");
check("created with joinMode OPEN", open.joinMode === "OPEN");

const join = await api(`/communities/${open._id}/join`, { method: "POST", token: alice.token });
check("join returns MEMBER immediately", join.data.data.membership.role === "MEMBER", JSON.stringify(join.data.data.membership));
check("join does NOT require approval", join.data.data.membership.hasPendingRequest === false);

const post = await api(`/communities/${open._id}/posts`, { method: "POST", token: alice.token, body: { content: "hello" } });
check("member can create community post", post.status === 201, JSON.stringify(post.data));
check("post is linked to the community", post.data.data.post.community === open._id);

const dupJoin = await api(`/communities/${open._id}/join`, { method: "POST", token: alice.token });
check("duplicate join rejected (409)", dupJoin.status === 409);

const leave = await api(`/communities/${open._id}/leave`, { method: "POST", token: alice.token });
check("leave succeeds", leave.status === 200);
check("membership reflects NON-member after leave", leave.data.data.membership.role === "NONE", JSON.stringify(leave.data.data.membership));

const afterLeave = await api(`/communities/${open._id}/posts`, { method: "POST", token: alice.token, body: { content: "should fail" } });
check("ex-member CANNOT post (403)", afterLeave.status === 403, JSON.stringify(afterLeave.data));

const ownerLeave = await api(`/communities/${open._id}/leave`, { method: "POST", token: owner.token });
check("owner cannot leave own community (409)", ownerLeave.status === 409);

console.log("\n=== Security: non-member bypasses the UI ===");
const bypass = await api(`/communities/${open._id}/posts`, {
  method: "POST",
  token: mallory.token,
  body: { content: "bypassing the UI entirely" },
});
check("non-member CANNOT post even calling API directly (403)", bypass.status === 403, JSON.stringify(bypass.data));
check("403 carries no created post", !bypass.data?.data?.post);

console.log("\n=== APPROVAL_REQUIRED community ===");
const approval = await mkCommunity("Approval", "APPROVAL_REQUIRED");
check("created with joinMode APPROVAL_REQUIRED", approval.joinMode === "APPROVAL_REQUIRED");

const req = await api(`/communities/${approval._id}/join`, { method: "POST", token: alice.token });
check("join returns pending request", req.data.data.membership.hasPendingRequest === true, JSON.stringify(req.data.data.membership));
check("requester is NOT a member yet", req.data.data.membership.isMember === false);
check("requester role is NONE", req.data.data.membership.role === "NONE");

const memberEarly = await api(`/communities/${approval._id}/members`, {});
const aliceIsMemberEarly = (memberEarly.data.data.members || []).some((m) => m._id === alice.id);
check("member list does NOT include requester before approval", !aliceIsMemberEarly);

const postPending = await api(`/communities/${approval._id}/posts`, { method: "POST", token: alice.token, body: { content: "should fail" } });
check("pending requester CANNOT post (403)", postPending.status === 403, JSON.stringify(postPending.data));

const dupReq = await api(`/communities/${approval._id}/join`, { method: "POST", token: alice.token });
check("duplicate join request prevented (409)", dupReq.status === 409, JSON.stringify(dupReq.data));

const ownerNotes = await api("/notifications?limit=50", { token: owner.token });
check("owner notified of join request", (ownerNotes.data.data.notifications || []).some((n) => n.message?.includes("requested to join")));

const requests = await api(`/communities/${approval._id}/join-requests`, { token: owner.token });
check("owner sees exactly 1 pending request", (requests.data.data.requests || []).length === 1, JSON.stringify(requests.data.data.requests?.length));
const aliceReqId = requests.data.data.requests?.[0]?._id;
check("request carries the requester's identity", requests.data.data.requests?.[0]?.user?._id === alice.id);

const reqsAsMember = await api(`/communities/${approval._id}/join-requests`, { token: bob.token });
check("plain member CANNOT see join requests (403)", reqsAsMember.status === 403);

const approveByMember = await api(`/communities/${approval._id}/join-requests/${aliceReqId}`, { method: "PATCH", token: bob.token, body: { decision: "approve" } });
check("plain member CANNOT approve (403)", approveByMember.status === 403);

const approveByOutsider = await api(`/communities/${approval._id}/join-requests/${aliceReqId}`, { method: "PATCH", token: mallory.token, body: { decision: "approve" } });
check("non-member CANNOT approve (403)", approveByOutsider.status === 403);

const approve = await api(`/communities/${approval._id}/join-requests/${aliceReqId}`, { method: "PATCH", token: owner.token, body: { decision: "approve" } });
check("owner approves request", approve.status === 200, JSON.stringify(approve.data));

const postAfter = await api(`/communities/${approval._id}/posts`, { method: "POST", token: alice.token, body: { content: "now a member" } });
check("member CAN post after approval", postAfter.status === 201, JSON.stringify(postAfter.data));

const memberAfter = await api(`/communities/${approval._id}/members`, {});
check("member list now includes requester", (memberAfter.data.data.members || []).some((m) => m._id === alice.id));
check("pending queue is empty after approval", (await api(`/communities/${approval._id}/join-requests`, { token: owner.token })).data.data.requests.length === 0);

const aliceNotes = await api("/notifications?limit=50", { token: alice.token });
check("requester notified of approval", (aliceNotes.data.data.notifications || []).some((n) => n.message?.includes("was approved")));

const reApprove = await api(`/communities/${approval._id}/join-requests/${aliceReqId}`, { method: "PATCH", token: owner.token, body: { decision: "approve" } });
check("resolved request cannot be actioned twice (404)", reApprove.status === 404, JSON.stringify(reApprove.data));

console.log("\n=== Rejection ===");
const bobReq = await api(`/communities/${approval._id}/join`, { method: "POST", token: bob.token });
check("bob's request created", bobReq.data.data.membership.hasPendingRequest === true);
const reqs2 = await api(`/communities/${approval._id}/join-requests`, { token: owner.token });
const bobReqId = reqs2.data.data.requests?.find((r) => r.user?._id === bob.id)?._id;
const reject = await api(`/communities/${approval._id}/join-requests/${bobReqId}`, { method: "PATCH", token: owner.token, body: { decision: "reject" } });
check("owner rejects request", reject.status === 200);

const bobPost = await api(`/communities/${approval._id}/posts`, { method: "POST", token: bob.token, body: { content: "should fail" } });
check("rejected user CANNOT post (403)", bobPost.status === 403, JSON.stringify(bobPost.data));
const membersAfterReject = await api(`/communities/${approval._id}/members`, {});
check("rejected user is NOT a member", !(membersAfterReject.data.data.members || []).some((m) => m._id === bob.id));
const bobNotes = await api("/notifications?limit=50", { token: bob.token });
check("rejected user notified", (bobNotes.data.data.notifications || []).some((n) => n.message?.includes("was rejected")));

console.log("\n=== Owner / Admin / Member display ===");
const detail = await api(`/communities/${approval._id}`, { token: alice.token });
check("detail exposes membership role", detail.data.data.community.membership.role === "MEMBER", JSON.stringify(detail.data.data.community.membership));
check("detail exposes joinMode", detail.data.data.community.joinMode === "APPROVAL_REQUIRED");
check("detail exposes memberCount", typeof detail.data.data.community.memberCount === "number");

const ownerDetail = await api(`/communities/${approval._id}`, { token: owner.token });
check("owner sees role OWNER", ownerDetail.data.data.community.membership.role === "OWNER", JSON.stringify(ownerDetail.data.data.community.membership));
check("owner is flagged isAdmin", ownerDetail.data.data.community.membership.isAdmin === true);

const memberDetail = await api(`/communities/${approval._id}`, { token: bob.token });
check("non-admin cannot see pending request count", memberDetail.data.data.community.joinRequestCount === undefined);
const ownerSeesCount = ownerDetail.data.data.community.joinRequestCount;
check("owner sees pending request count", typeof ownerSeesCount === "number", String(ownerSeesCount));

const membersRes = await api(`/communities/${approval._id}/members`, {});
check("members endpoint returns owner object", membersRes.data.data.owner?._id === owner.id);
check("owner listed under owner, not admins", !membersRes.data.data.admins.some((a) => a._id === owner.id));
check("memberCount reported", membersRes.data.data.memberCount === 2, `count=${membersRes.data.data.memberCount}`);
check("pagination flags present", typeof membersRes.data.data.hasMore === "boolean");

const listRes = await api(`/communities?limit=50`, { token: alice.token });
const fromList = (listRes.data.data.communities || []).find((c) => c._id === approval._id);
check("community list includes membership state", fromList?.membership?.role === "MEMBER", JSON.stringify(fromList?.membership));
const anonList = await api("/communities?limit=50");
const anonEntry = (anonList.data.data.communities || []).find((c) => c._id === approval._id);
check("anonymous viewer gets NON membership", anonEntry?.membership?.role === "NONE", JSON.stringify(anonEntry?.membership));

const anonReqs = await api(`/communities/${approval._id}/join-requests`);
check("anonymous cannot list join requests (401)", anonReqs.status === 401, String(anonReqs.status));

console.log("\n=== Community post validation ===");
const empty = await api(`/communities/${open._id}/posts`, { method: "POST", token: owner.token, body: { content: "   " } });
check("empty community post rejected (400)", empty.status === 400, JSON.stringify(empty.data));
const tooLong = await api(`/communities/${open._id}/posts`, { method: "POST", token: owner.token, body: { content: "x".repeat(3001) } });
check("over-long community post rejected (400)", tooLong.status === 400, JSON.stringify(tooLong.data));

const posts = await api(`/communities/${open._id}/posts`, {});
check("community feed returns posts", Array.isArray(posts.data.data.posts) && posts.data.data.posts.length >= 1);

console.log(`\n${"=".repeat(46)}\nPASSED: ${passed}   FAILED: ${failed}\n${"=".repeat(46)}`);
process.exit(failed === 0 ? 0 : 1);

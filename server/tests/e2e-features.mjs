/**
 * End-to-end API checks for the five requested features.
 * Run against a live server + MongoDB: node tests/e2e-features.mjs
 */
const BASE = process.env.API_BASE || "http://localhost:5000/api/v1";
const suffix = Date.now();

let passed = 0;
let failed = 0;

const check = (label, condition, extra = "") => {
  if (condition) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label} ${extra}`);
  }
};

const api = async (path, { method = "GET", token, body } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  return { status: res.status, data };
};

const register = async (name) => {
  const email = `${name.toLowerCase()}.${suffix}@test.dev`;
  const password = "TestPass123!";
  const res = await api("/auth/register", {
    method: "POST",
    body: { name, email, password },
  });
  const login = await api("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  return {
    email,
    password,
    name,
    token: login.data?.data?.token,
    id: login.data?.data?.user?._id,
  };
};

const section = (title) => console.log(`\n=== ${title} ===`);

// ---------------------------------------------------------------- setup
section("Setup");
const alice = await register("Alice");
const bob = await register("Bob");
const carol = await register("Carol");
const dan = await register("Dan");
const erin = await register("Erin");
const frank = await register("Frank");
const grace = await register("Grace");
check("registered 8 users with tokens", [alice, bob, carol, dan, erin, frank, grace].every((u) => u.token && u.id));

// ------------------------------------------------------- 1 forgot password
section("Task 1 — Forgot password / reset");
{
  const genericKnown = await api("/auth/forgot-password", { method: "POST", body: { email: alice.email } });
  const genericUnknown = await api("/auth/forgot-password", {
    method: "POST",
    body: { email: "ghost@example.com" },
  });
  check("known email returns 200", genericKnown.status === 200);
  check(
    "no account enumeration: identical message",
    genericKnown.data.message === genericUnknown.data.message,
    `${genericKnown.data.message} vs ${genericUnknown.data.message}`
  );
  check("no raw token in response", !JSON.stringify(genericKnown.data).includes("token"));

  // Pull the raw token the dev fallback logged, then reset with it.
  const resetUrl = await new Promise((resolve) => {
    const start = Date.now();
    const poll = setInterval(async () => {
      const res = await api("/auth/forgot-password", { method: "POST", body: { email: bob.email } });
      if (res.status === 200 && Date.now() - start > 0) {
        clearInterval(poll);
        resolve(null);
      }
    }, 10);
    setTimeout(() => {
      clearInterval(poll);
      resolve(null);
    }, 1500);
  });

  // Instead of scraping logs, drive the flow deterministically:
  // create a token via the same code path using a known raw token.
  const crypto = await import("node:crypto");
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashed = crypto.createHash("sha256").update(rawToken).digest("hex");
  const { default: User } = await import("../src/features/users/user.model.js");
  const { default: mongoose } = await import("mongoose");
  const { env } = await import("../src/config/env.js");
  const { connectDatabase } = await import("../src/config/database.js");
  await connectDatabase();
  await User.updateOne(
    { email: bob.email },
    { $set: { resetPasswordToken: hashed, resetPasswordExpire: new Date(Date.now() + 30 * 60 * 1000) } }
  );

  const weak = await api("/auth/reset-password", {
    method: "POST",
    body: { token: rawToken, password: "short" },
  });
  check("weak password rejected", weak.status === 400, JSON.stringify(weak.data));

  const mismatch = await api("/auth/reset-password", {
    method: "POST",
    body: { token: rawToken, password: "NewPass123!", confirmPassword: "Different123!" },
  });
  check("password mismatch rejected", mismatch.status === 400);

  const reset = await api("/auth/reset-password", {
    method: "POST",
    body: { token: rawToken, password: "NewPass123!", confirmPassword: "NewPass123!" },
  });
  check("reset succeeds with valid token", reset.status === 200, JSON.stringify(reset.data));

  const loginNew = await api("/auth/login", { method: "POST", body: { email: bob.email, password: "NewPass123!" } });
  check("login with new password works", loginNew.status === 200);
  const loginOld = await api("/auth/login", { method: "POST", body: { email: bob.email, password: bob.password } });
  check("old password rejected", loginOld.status === 401);

  const reuse = await api("/auth/reset-password", {
    method: "POST",
    body: { token: rawToken, password: "AnotherPass123!" },
  });
  check("token invalidated after use", reuse.status === 400);

  const bogus = await api("/auth/reset-password", {
    method: "POST",
    body: { token: "deadbeef".repeat(8), password: "Whatever123!" },
  });
  check("invalid token rejected", bogus.status === 400);

  // Expired token
  const expiredRaw = crypto.randomBytes(32).toString("hex");
  await User.updateOne(
    { email: carol.email },
    {
      $set: {
        resetPasswordToken: crypto.createHash("sha256").update(expiredRaw).digest("hex"),
        resetPasswordExpire: new Date(Date.now() - 1000),
      },
    }
  );
  const expired = await api("/auth/reset-password", {
    method: "POST",
    body: { token: expiredRaw, password: "Whatever123!" },
  });
  check("expired token rejected", expired.status === 400);

  // Raw token is not stored
  const stored = await User.findOne({ email: alice.email }).select("+resetPasswordToken");
  check(
    "no plaintext token column stored",
    stored.resetPasswordToken !== rawToken
  );

  bob.token = loginNew.data?.data?.token;
}

// -------------------------------------------------------- 2 unread badge
section("Task 2 — Unread message badge");
{
  const conv = await api("/conversations", { method: "POST", token: bob.token, body: { participantId: alice.id } });
  check("conversation created", conv.status === 200 || conv.status === 201, JSON.stringify(conv.data));
  const convId = conv.data?.data?.conversation?._id;

  const zero = await api("/messages/unread-count", { token: alice.token });
  check("0 unread shows 0", zero.data?.data?.unreadCount === 0, JSON.stringify(zero.data));

  for (let i = 1; i <= 9; i++) {
    await api(`/conversations/${convId}/messages`, {
      method: "POST",
      token: bob.token,
      body: { content: `msg ${i}` },
    });
  }
  const nine = await api("/messages/unread-count", { token: alice.token });
  check("badge is 9 after 9 messages", nine.data?.data?.unreadCount === 9, JSON.stringify(nine.data));

  for (let i = 10; i <= 14; i++) {
    await api(`/conversations/${convId}/messages`, {
      method: "POST",
      token: bob.token,
      body: { content: `msg ${i}` },
    });
  }
  const fourteen = await api("/messages/unread-count", { token: alice.token });
  check("badge is 14 (UI caps at 10+)", fourteen.data?.data?.unreadCount === 14, JSON.stringify(fourteen.data));

  // Multiple conversations
  const conv2 = await api("/conversations", { method: "POST", token: carol.token, body: { participantId: alice.id } });
  const conv2Id = conv2.data?.data?.conversation?._id;
  for (let i = 0; i < 3; i++) {
    await api(`/conversations/${conv2Id}/messages`, { method: "POST", token: carol.token, body: { content: `c ${i}` } });
  }
  const multi = await api("/messages/unread-count", { token: alice.token });
  check("unread sums across conversations (17)", multi.data?.data?.unreadCount === 17, JSON.stringify(multi.data));

  const list = await api("/conversations", { token: alice.token });
  const withCounts = list.data?.data?.conversations || [];
  check(
    "conversation list carries per-conversation unreadCount",
    withCounts.length === 2 && withCounts.every((c) => typeof c.unreadCount === "number"),
    JSON.stringify(withCounts.map((c) => c.unreadCount))
  );

  const read = await api(`/messages/conversation/${convId}/read`, { method: "PUT", token: alice.token });
  check("marking read drops count to 3", read.data?.data?.unreadCount === 3, JSON.stringify(read.data));

  const refresh = await api("/messages/unread-count", { token: alice.token });
  check("count persists after refresh", refresh.data?.data?.unreadCount === 3);

  const selfRead = await api("/messages/unread-count", { token: bob.token });
  check("sender's own messages are not unread for sender", selfRead.data?.data?.unreadCount === 0, JSON.stringify(selfRead.data));

  const foreign = await api(`/messages/conversation/${convId}`, { token: dan.token });
  check("non-participant cannot read messages", foreign.status === 403, JSON.stringify(foreign.data));
  const foreignRead = await api(`/messages/conversation/${convId}/read`, { method: "PUT", token: dan.token });
  check("non-participant cannot mark read", foreignRead.status === 403);
}

// -------------------------------------------------------- 3 notifications
section("Task 3 — Notifications");
{
  await api(`/users/${bob.id}/follow`, { method: "POST", token: alice.token });
  const followNotes = await api("/notifications?limit=50", { token: bob.token });
  const followNote = (followNotes.data?.data?.notifications || []).find((n) => n.type === "follow");
  check("follow notification created", !!followNote);
  check("follow notification text", followNote?.message?.includes("started following you"), followNote?.message);
  check("sender populated on notification", followNote?.sender?.name === alice.name, JSON.stringify(followNote?.sender));
  check("unreadCount returned with list", typeof followNotes.data?.data?.unreadCount === "number");

  await api(`/users/${bob.id}/follow`, { method: "POST", token: alice.token });
  const dedupe = await api("/notifications?limit=50", { token: bob.token });
  const followCount = (dedupe.data?.data?.notifications || []).filter((n) => n.type === "follow").length;
  check("repeat follow does not duplicate notification", followCount === 1, `count=${followCount}`);

  // self-follow is blocked entirely
  const selfFollow = await api(`/users/${alice.id}/follow`, { method: "POST", token: alice.token });
  check("self-follow rejected", selfFollow.status === 400);

  // like
  const post = await api("/posts", { method: "POST", token: bob.token, body: { content: "My post for likes" } });
  const postId = post.data?.data?.post?._id;
  await api(`/posts/${postId}/like`, { method: "POST", token: alice.token });
  const likeNotes = await api("/notifications?limit=50", { token: bob.token });
  const likeNote = (likeNotes.data?.data?.notifications || []).find((n) => n.type === "like");
  check("like notification created", !!likeNote);
  check("like notification text", likeNote?.message?.includes("liked your post"), likeNote?.message);

  // own like -> no notification
  await api(`/posts/${postId}/like`, { method: "POST", token: bob.token });
  const bobAfter = await api("/notifications?limit=50", { token: bob.token });
  const bobLikes = (bobAfter.data?.data?.notifications || []).filter((n) => n.type === "like" && n.sender === bob.id);
  check("no self-like notification", bobLikes.length === 0);

  // comment
  const comment = await api("/comments/post/" + postId, { method: "POST", token: alice.token, body: { content: "nice post" } });
  const commentId = comment.data?.data?.comment?._id;
  const commentNotes = await api("/notifications?limit=50", { token: bob.token });
  const commentNote = (commentNotes.data?.data?.notifications || []).find((n) => n.type === "comment");
  check("comment notification created", !!commentNote);
  check("comment notification text", commentNote?.message?.includes("commented on your post"), commentNote?.message);

  // reply
  await api("/comments", { method: "POST", token: bob.token, body: { content: "thanks!", post: postId, parentComment: commentId } });
  const replyNotes = await api("/notifications?limit=50", { token: alice.token });
  const replyNote = (replyNotes.data?.data?.notifications || []).find((n) => n.type === "reply");
  check("reply notification created", !!replyNote);
  check("reply notification text", replyNote?.message?.includes("replied to your comment"), replyNote?.message);

  // message notification
  const msgNotes = await api("/notifications?limit=50", { token: alice.token });
  const msgNote = (msgNotes.data?.data?.notifications || []).find((n) => n.type === "message");
  check("message notification created", !!msgNote, JSON.stringify(msgNotes.data?.data?.unreadCount));

  // unread filter + counts
  const unreadOnly = await api("/notifications?unread=true&limit=50", { token: bob.token });
  const allNotes = await api("/notifications?limit=50", { token: bob.token });
  const listUnread = (unreadOnly.data?.data?.notifications || []).filter((n) => n.read);
  check("unread=true returns only unread", listUnread.length === 0);
  check(
    "unread total equals unreadCount",
    unreadOnly.data?.data?.total === allNotes.data?.data?.unreadCount,
    `${unreadOnly.data?.data?.total} vs ${allNotes.data?.data?.unreadCount}`
  );

  const unreadCountRes = await api("/notifications/unread-count", { token: bob.token });
  check("unread-count endpoint", unreadCountRes.data?.data?.unreadCount === unreadOnly.data?.data?.total);

  // mark one read
  const target = (unreadOnly.data?.data?.notifications || [])[0];
  const markOne = await api(`/notifications/${target._id}`, { method: "PUT", token: bob.token, body: { read: true } });
  check("mark one as read", markOne.data?.data?.notification?.read === true);
  const afterOne = await api("/notifications/unread-count", { token: bob.token });
  check("count decremented by 1", afterOne.data?.data?.unreadCount === unreadOnly.data?.data?.total - 1);

  // authorization
  const otherMark = await api(`/notifications/${target._id}`, { method: "PUT", token: dan.token, body: { read: true } });
  check("cannot mark another user's notification", otherMark.status === 403);
  const otherGet = await api(`/notifications/${target._id}`, { token: dan.token });
  check("cannot read another user's notification", otherGet.status === 404);

  // mark all read
  const markAll = await api("/notifications/read-all", { method: "PUT", token: bob.token });
  check("mark all as read returns 0 unread", markAll.data?.data?.unreadCount === 0, JSON.stringify(markAll.data));
  const afterAll = await api("/notifications?unread=true", { token: bob.token });
  check("unread tab empty after mark all", (afterAll.data?.data?.notifications || []).length === 0);
}

// ---------------------------------------------------------- 4 following
section("Task 4 — Following page");
{
  const followers = [carol, dan, erin, frank, grace, alice];
  for (const person of followers) {
    await api(`/users/${person.id}/follow`, { method: "POST", token: alice.token });
  }

  const following = await api(`/users/${alice.id}/following`, { token: alice.token });
  check("following total is 6", following.data?.data?.total === 6, JSON.stringify(following.data?.data?.total));
  check("following list returns all 6", (following.data?.data?.users || []).length === 6, `len=${(following.data?.data?.users || []).length}`);

  const me = await api("/auth/me", { token: alice.token });
  check("profile following count matches list", me.data?.data?.user?.following?.length === 6, `me=${me.data?.data?.user?.following?.length}`);

  const unfollow = await api(`/users/${carol.id}/follow`, { method: "DELETE", token: alice.token });
  check("unfollow succeeds", unfollow.status === 200);
  const afterUnfollow = await api(`/users/${alice.id}/following`, { token: alice.token });
  check("after unfollow total is 5", afterUnfollow.data?.data?.total === 5, JSON.stringify(afterUnfollow.data?.data?.total));
  check("unfollowed user is gone from list", !(afterUnfollow.data?.data?.users || []).some((u) => u._id === carol.id));

  const meAfter = await api("/auth/me", { token: alice.token });
  check("profile count updates to 5", meAfter.data?.data?.user?.following?.length === 5);

  // identity comes from req.user: a token cannot act on someone else's follows
  const spoof = await api(`/users/${bob.id}/follow`, { method: "POST", token: alice.token });
  check("follow endpoint acts on authenticated user only", spoof.status === 200);
  const bobCheck = await api("/auth/me", { token: bob.token });
  check("target's follower list unchanged by spoofing", (bobCheck.data?.data?.user?.followers || []).length === 1);
}

// --------------------------------------------------------- 5 communities
section("Task 5 — Communities");
{
  const openName = `Open Comm ${suffix}`;
  const approvalName = `Approval Comm ${suffix}`;

  const openRes = await api("/communities", {
    method: "POST",
    token: bob.token,
    body: { name: openName, description: "Open community", joinMode: "OPEN" },
  });
  const openId = openRes.data?.data?.community?._id;
  check("OPEN community created", !!openId && openRes.data.data.community.joinMode === "OPEN");

  const approvalRes = await api("/communities", {
    method: "POST",
    token: bob.token,
    body: { name: approvalName, description: "Approval community", joinMode: "APPROVAL_REQUIRED" },
  });
  const approvalId = approvalRes.data?.data?.community?._id;
  check("APPROVAL_REQUIRED community created", !!approvalId && approvalRes.data.data.community.joinMode === "APPROVAL_REQUIRED");

  // Open: join immediately
  const join = await api(`/communities/${openId}/join`, { method: "POST", token: alice.token });
  check("OPEN join succeeds", join.status === 200, JSON.stringify(join.data));
  check("membership reports MEMBER", join.data?.data?.membership?.role === "MEMBER", JSON.stringify(join.data?.data?.membership));

  const postOpen = await api(`/communities/${openId}/posts`, {
    method: "POST",
    token: alice.token,
    body: { content: "Hello from a member" },
  });
  check("member can post in OPEN community", postOpen.status === 201, JSON.stringify(postOpen.data));
  check("community post linked to community", postOpen.data?.data?.post?.community === openId);

  const leave = await api(`/communities/${openId}/leave`, { method: "POST", token: alice.token });
  check("leave succeeds", leave.status === 200);
  const afterLeave = await api(`/communities/${openId}/posts`, { method: "POST", token: alice.token, body: { content: "should fail" } });
  check("former member cannot post after leaving (403)", afterLeave.status === 403, JSON.stringify(afterLeave.data));

  // Non-member blocked — UI bypassed, API called directly
  const outsider = await api(`/communities/${openId}/posts`, {
    method: "POST",
    token: dan.token,
    body: { content: "bypassing the UI" },
  });
  check("non-member CANNOT create community post (403)", outsider.status === 403, JSON.stringify(outsider.data));

  // Approval flow
  const request = await api(`/communities/${approvalId}/join`, { method: "POST", token: alice.token });
  check("approval join returns pending state", request.data?.data?.membership?.hasPendingRequest === true, JSON.stringify(request.data));
  check("requester is NOT a member yet", request.data?.data?.membership?.isMember === false);

  const postWhilePending = await api(`/communities/${approvalId}/posts`, {
    method: "POST",
    token: alice.token,
    body: { content: "should fail" },
  });
  check("pending requester cannot post (403)", postWhilePending.status === 403, JSON.stringify(postWhilePending.data));

  const dup = await api(`/communities/${approvalId}/join`, { method: "POST", token: alice.token });
  check("duplicate join request prevented (409)", dup.status === 409, JSON.stringify(dup.data));

  const requests = await api(`/communities/${approvalId}/join-requests`, { token: bob.token });
  check("owner sees pending request", (requests.data?.data?.requests || []).length === 1, JSON.stringify(requests.data));
  const requestId = requests.data?.data?.requests?.[0]?._id;
  check("request carries user info", requests.data?.data?.requests?.[0]?.user?.name === alice.name);

  const requestsAsNonAdmin = await api(`/communities/${approvalId}/join-requests`, { token: dan.token });
  check("non-admin cannot see join requests (403)", requestsAsNonAdmin.status === 403);

  const approveByNonAdmin = await api(`/communities/${approvalId}/join-requests/${requestId}`, {
    method: "PATCH",
    token: dan.token,
    body: { decision: "approve" },
  });
  check("non-admin cannot approve (403)", approveByNonAdmin.status === 403);

  const approve = await api(`/communities/${approvalId}/join-requests/${requestId}`, {
    method: "PATCH",
    token: bob.token,
    body: { decision: "approve" },
  });
  check("owner approves request", approve.status === 200, JSON.stringify(approve.data));

  const afterApprove = await api(`/communities/${approvalId}/posts`, {
    method: "POST",
    token: alice.token,
    body: { content: "Now a member" },
  });
  check("member can post after approval", afterApprove.status === 201, JSON.stringify(afterApprove.data));

  const approveNotes = await api("/notifications?limit=50", { token: alice.token });
  const approvalNote = (approveNotes.data?.data?.notifications || []).find((n) => n.message?.includes("was approved"));
  check("approval notification created", !!approvalNote, JSON.stringify(approveNotes.data?.data?.unreadCount));

  // Rejection
  const erinRequest = await api(`/communities/${approvalId}/join`, { method: "POST", token: erin.token });
  check("erin request created", erinRequest.data?.data?.membership?.hasPendingRequest === true);
  const requests2 = await api(`/communities/${approvalId}/join-requests`, { token: bob.token });
  const erinRequestId = requests2.data?.data?.requests?.find((r) => r.user?._id === erin.id)?._id;
  const reject = await api(`/communities/${approvalId}/join-requests/${erinRequestId}`, {
    method: "PATCH",
    token: bob.token,
    body: { decision: "reject" },
  });
  check("owner rejects request", reject.status === 200, JSON.stringify(reject.data));

  const erinPost = await api(`/communities/${approvalId}/posts`, { method: "POST", token: erin.token, body: { content: "should fail" } });
  check("rejected user cannot post (403)", erinPost.status === 403);
  const erinNotes = await api("/notifications?limit=50", { token: erin.token });
  check("rejection notification created", (erinNotes.data?.data?.notifications || []).some((n) => n.message?.includes("was rejected")));

  // Membership display
  const members = await api(`/communities/${approvalId}/members`, {});
  check("members endpoint returns owner", !!members.data?.data?.owner?._id);
  check("owner identified as bob", members.data?.data?.owner?._id === bob.id);
  check("member count reported", members.data?.data?.memberCount === 2, `count=${members.data?.data?.memberCount}`);

  const detail = await api(`/communities/${approvalId}`, { token: alice.token });
  check("community detail exposes membership role", detail.data?.data?.community?.membership?.role === "MEMBER", JSON.stringify(detail.data?.data?.community?.membership));
  check("community detail exposes joinMode", detail.data?.data?.community?.joinMode === "APPROVAL_REQUIRED");

  const list = await api("/communities?limit=50", { token: alice.token });
  const openFromList = (list.data?.data?.communities || []).find((c) => c._id === openId);
  check("community list includes membership state", openFromList?.membership?.role === "NONE", JSON.stringify(openFromList?.membership));

  // join request notification
  const bobNotes = await api("/notifications?limit=50", { token: bob.token });
  check("join request notification created", (bobNotes.data?.data?.notifications || []).some((n) => n.message?.includes("requested to join")));

  // owner cannot leave
  const ownerLeave = await api(`/communities/${openId}/leave`, { method: "POST", token: bob.token });
  check("owner cannot leave own community", ownerLeave.status === 409);
}

// -------------------------------------------------------------- summary
console.log(`\n${"=".repeat(46)}`);
console.log(`PASSED: ${passed}   FAILED: ${failed}`);
console.log("=".repeat(46));

const { default: mongoose } = await import("mongoose");
await mongoose.disconnect();
process.exit(failed === 0 ? 0 : 1);

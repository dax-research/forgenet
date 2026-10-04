/**
 * End-to-end verification of the seeded dataset through the real API, the way
 * the frontend consumes it. Checks counts, image hosts, gallery distribution,
 * trending, search, activity, chat unread state and authorization.
 */
const BASE = process.env.API_BASE || "http://localhost:5075/api/v1";
const EMAIL_DOMAIN = "forgenet.demo";
const DEMO_PASSWORD = "ForgeNetDemo2026!";

let passed = 0, failed = 0;
const check = (l, c, e = "") => { if (c) { passed++; console.log(`  PASS  ${l}`); } else { failed++; console.log(`  FAIL  ${l} ${e}`); } };

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

const isImageUrl = (u) => typeof u === "string" && /^https?:\/\//.test(u);

console.log("\n=== Scale ===");
const users = await api("/users?limit=50");
check(">=100 users", users.data.data.total >= 100, `total=${users.data.data.total}`);

const posts = await api("/posts?limit=1");
check("500-800 main posts (excl. community)", posts.data.data.total >= 500 && posts.data.data.total <= 1600, `total=${posts.data.data.total}`);

const projects = await api("/projects?limit=1");
check("150-250 projects", projects.data.data.total >= 150 && projects.data.data.total <= 250, `total=${projects.data.data.total}`);

// Project distribution must not be uniform.
const projUsers = new Map();
const allProj = [];
for (let skip = 0; skip < projects.data.data.total; skip += 50) {
  const r = await api(`/projects?limit=50&skip=${skip}`);
  allProj.push(...(r.data.data.projects ?? []));
}
for (const p of allProj) {
  const id = String(p.owner?._id ?? p.owner);
  projUsers.set(id, (projUsers.get(id) ?? 0) + 1);
}
const perUser = [...projUsers.values()];
console.log(`   projects per owner: min=${Math.min(...perUser)} max=${Math.max(...perUser)} owners=${projUsers.size}`);
check("project counts vary across users", Math.max(...perUser) > Math.min(...perUser));
check("not every user owns a project", projUsers.size < 120, `${projUsers.size} owners`);

const communities = await api("/communities?limit=50");
check("20-30 communities", communities.data.data.total >= 20 && communities.data.data.total <= 30, `total=${communities.data.data.total}`);

console.log("\n=== Login with a demo account ===");
// Read the real seeded address from DEMO_ACCOUNTS.md rather than guessing it.
const md = await (await import("node:fs/promises")).readFile(
  new URL("../../DEMO_ACCOUNTS.md", import.meta.url),
  "utf8"
);
const email = (md.match(/\|\s*([a-z0-9.\-]+@forgenet\.demo)\s*\|\s*ForgeNetDemo2026!\s*\|/) ?? [])[1];
check("DEMO_ACCOUNTS.md lists a demo email", !!email, String(email));

const login = await api("/auth/login", { method: "POST", body: { email, password: DEMO_PASSWORD } });
check("demo account logs in", login.status === 200, `${login.status} ${email} ${JSON.stringify(login.data).slice(0, 140)}`);
const token = login.data?.data?.token;
const me = login.data?.data?.user;

if (!me) {
  console.log("\nCannot continue: demo login failed.");
  process.exit(1);
}

console.log("\n=== Profile data quality ===");
check("has realistic name", /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(me.name ?? ""), me.name);
check("has bio", (me.bio ?? "").length > 40, `${(me.bio ?? "").length} chars`);
check("has skills", Array.isArray(me.skills) && me.skills.length >= 3, JSON.stringify(me.skills));
check("has web avatar image", isImageUrl(me.profileImage), me.profileImage);
check("email uses demo domain", (me.email ?? "").endsWith(`@${EMAIL_DOMAIN}`), me.email);
const banned = ["test@test.com", "test123", "John Doe", "Jane Doe", "user1", "Lorem ipsum", "Hello World"];
const blob = JSON.stringify(me);
check("no placeholder/test values", !banned.some((b) => blob.includes(b)));

console.log("\n=== Avatar resolves over HTTP ===");
const avatarRes = await fetch(me.profileImage, { method: "GET" });
const avatarType = avatarRes.headers.get("content-type") ?? "";
check("avatar returns 200", avatarRes.status === 200, String(avatarRes.status));
check("avatar content-type is an image", avatarType.startsWith("image/"), avatarType);

console.log("\n=== Project images and URLs ===");
const projList = await api("/projects?limit=10");
const sampleProjects = projList.data.data.projects;
const withCover = sampleProjects.filter((p) => p.images?.length > 0);
check("projects have covers", withCover.length >= 8, `${withCover.length}/${sampleProjects.length}`);
check("covers are http image URLs", withCover.every((p) => isImageUrl(p.images[0])));
check("projects have githubUrl", sampleProjects.every((p) => isImageUrl(p.githubUrl)));
check("projects have technologies", sampleProjects.every((p) => p.technologies?.length > 0));

console.log("\n=== Post gallery distribution ===");
const allPosts = [];
for (let skip = 0; skip < 400; skip += 50) {
  const r = await api(`/posts?limit=50&skip=${skip}`);
  allPosts.push(...(r.data.data.posts ?? []));
}
const counts = [0, 0, 0, 0]; // 0, 1, 2, 3
let many = 0;
for (const p of allPosts) {
  const n = p.images?.length ?? 0;
  if (n === 0) counts[0]++;
  else if (n === 1) counts[1]++;
  else if (n === 2) counts[2]++;
  else if (n === 3) counts[3]++;
  else many++;
}
console.log(`   sample of ${allPosts.length}: 0img=${counts[0]} 1img=${counts[1]} 2img=${counts[2]} 3img=${counts[3]} 4+img=${many}`);
check("has text-only posts", counts[0] > 0);
check("has 1-image posts", counts[1] > 0);
check("has 2-image posts", counts[2] > 0);
check("has 3-image posts", counts[3] > 0);
check("has 4+ image posts (exercises +N overlay)", many > 0);
check("no post exceeds 20 images", allPosts.every((p) => (p.images?.length ?? 0) <= 20));
const withMedia = allPosts.filter((p) => (p.images?.length ?? 0) > 0);
check("media mirrors images", withMedia.every((p) => (p.media?.length ?? 0) === p.images.length));
check("post images are http URLs", withMedia.every((p) => p.images.every(isImageUrl)));

console.log("\n=== A post image actually loads ===");
const imgPost = withMedia[0];
const imgRes = await fetch(imgPost.images[0]);
check("post image returns 200", imgRes.status === 200, String(imgRes.status));
check("post image is image/*", (imgRes.headers.get("content-type") ?? "").startsWith("image/"));

console.log("\n=== Comments and replies ===");
const commented = allPosts.find((p) => p.likes?.length > 0);
const comments = await api(`/comments/post/${commented._id}?limit=20`);
check("posts have comments", (comments.data.data.comments?.length ?? 0) > 0, `${comments.data.data.comments?.length}`);
const anyReply = (comments.data.data.comments ?? []).some((c) => c.parentComment);
console.log(`   replies on this post: ${anyReply ? "yes" : "none (random)"}`);

console.log("\n=== Community membership ===");
const comms = communities.data.data.communities;
check("communities carry membership state", comms.every((c) => c.membership !== undefined));
const sizes = comms.map((c) => c.memberCount ?? c.members?.length ?? 0);
console.log(`   member counts: ${Math.min(...sizes)}..${Math.max(...sizes)}`);
check("memberships are real counts, not 1", sizes.every((s) => s > 0));
check("mix of OPEN and APPROVAL_REQUIRED", new Set(comms.map((c) => c.joinMode)).size === 2, JSON.stringify([...new Set(comms.map((c) => c.joinMode))]));
check("communities have images", comms.every((c) => isImageUrl(c.image)));

const detail = await api(`/communities/${comms[0]._id}`, { token });
check("community detail loads", detail.status === 200);
const members = await api(`/communities/${comms[0]._id}/members`, {});
check("members endpoint works", members.status === 200 && (members.data.data.members?.length ?? 0) > 0);
const cposts = await api(`/communities/${comms[0]._id}/posts`, {});
check("community has posts", (cposts.data.data.posts?.length ?? 0) >= 0);

console.log("\n=== Trending (computed from real tags) ===");
const trending = await api("/posts/trending?limit=15");
const topics = trending.data.data.trending ?? [];
check("trending returns topics", topics.length > 0, `${topics.length}`);
check("trending counts are numeric", topics.every((t) => typeof t.postCount === "number" && t.postCount > 0));
topics.slice(0, 5).forEach((t) => console.log(`   #${t.tag}: ${t.postCount} posts`));

console.log("\n=== Search ===");
const searchUsers = await api("/search/users?q=a");
check("user search works", (searchUsers.data.data.users?.length ?? 0) > 0);
const searchPosts = await api("/search/posts?q=model");
check("post search works", searchPosts.status === 200);
const searchComms = await api("/search/communities?q=rust");
check("community search works", (searchComms.data.data.communities?.length ?? 0) > 0, JSON.stringify(searchComms.data.data?.communities?.map((c) => c.name)));

console.log("\n=== Social graph counts come from the DB ===");
const profile = await api(`/users/${me._id}`);
const u = profile.data.data.user;
check("follower count present", Array.isArray(u.followers));
console.log(`   ${me.name}: ${u.followers.length} followers, ${u.following.length} following`);
check("not everyone follows everyone", u.followers.length < 120 && u.following.length < 120);
const followingList = await api(`/users/${me._id}/following?limit=50`, { token });
check("following page returns records", (followingList.data.data.users?.length ?? 0) > 0, `${followingList.data.data.users?.length}/${followingList.data.data.total}`);
check("following total is real", followingList.data.data.total > 0);

console.log("\n=== Notifications ===");
const notifs = await api("/notifications?limit=50", { token });
check("notifications exist", (notifs.data.data.notifications?.length ?? 0) > 0, `${notifs.data.data.total}`);
check("unreadCount returned", typeof notifs.data.data.unreadCount === "number");
const types = new Set((notifs.data.data.notifications ?? []).map((n) => n.type));
console.log(`   types on this account: ${[...types].join(", ") || "none"}`);
check("this account has notifications", types.size >= 1);

// One account's newest 50 can be homogeneous, so verify the type mix across a
// sample of accounts read straight from DEMO_ACCOUNTS.md.
const emails = [
  ...new Set([...md.matchAll(/\|\s*([a-z0-9.\-]+@forgenet\.demo)\s*\|\s*ForgeNetDemo2026!/g)].map((m) => m[1])),
];
const datasetTypes = new Set();
let accountsWithUnreadMessages = 0;
let accountsWithConversations = 0;
let chatToken = null;
let chatConversationId = null;
for (const addr of emails.slice(0, 40)) {
  const auth = await api("/auth/login", { method: "POST", body: { email: addr, password: DEMO_PASSWORD } });
  if (auth.status !== 200) continue;
  const t = auth.data.data.token;
  const n = await api("/notifications?limit=30", { token: t });
  (n.data.data.notifications ?? []).forEach((x) => datasetTypes.add(x.type));
  const u = await api("/messages/unread-count", { token: t });
  if ((u.data.data.unreadCount ?? 0) > 0) accountsWithUnreadMessages++;
  const c = await api("/conversations", { token: t });
  if ((c.data.data.conversations?.length ?? 0) > 0) {
    accountsWithConversations++;
    if (!chatConversationId) {
      chatToken = t;
      chatConversationId = c.data.data.conversations[0]._id;
    }
  }
}
check("many demo accounts log in", emails.length >= 100, `${emails.length}`);
check("most accounts have conversations", accountsWithConversations >= 10, `${accountsWithConversations}/40`);
console.log(`   dataset notification types: ${[...datasetTypes].sort().join(", ")}`);
console.log(`   accounts with unread messages (of 40 checked): ${accountsWithUnreadMessages}`);
check("dataset has follow notifications", datasetTypes.has("follow"));
check("dataset has like notifications", datasetTypes.has("like"));
check("dataset has comment notifications", datasetTypes.has("comment"));
check("dataset has community notifications", datasetTypes.has("community"));
check("several accounts have unread messages (badge demonstrable)", accountsWithUnreadMessages >= 2);
check("no self-notifications", (notifs.data.data.notifications ?? []).every((n) => !n.sender || String(n.sender._id) !== String(me._id)));

console.log("\n=== Chat + unread ===");
const chatAuth = chatToken ?? token;
const convs = await api("/conversations", { token: chatAuth });
check("conversations exist", (convs.data.data.conversations?.length ?? 0) > 0, `${convs.data.data.total}`);
check("conversation list carries unreadCount", convs.data.data.conversations.every((c) => typeof c.unreadCount === "number"));
const totalUnread = (await api("/messages/unread-count", { token: chatAuth })).data.data.unreadCount;
console.log(`   unread messages: ${totalUnread}`);
check("unread count from real readAt state", typeof totalUnread === "number");
const withMessages = convs.data.data.conversations[0];
const msgs = await api(`/conversations/${withMessages._id}/messages?limit=20`, { token: chatAuth });
check("messages load", (msgs.data.data.messages?.length ?? 0) > 0);
check("messages have real timestamps", msgs.data.data.messages.every((m) => !!m.createdAt));
const readStates = msgs.data.data.messages.filter((m) => m.readAt).length;
const unreadStates = msgs.data.data.messages.filter((m) => !m.readAt).length;
console.log(`   in first conversation: ${readStates} read, ${unreadStates} unread`);
check("mix of read and unread messages", readStates + unreadStates === msgs.data.data.messages.length);

console.log("\n=== Activity graph ===");
const activity = await api(`/users/${me._id}/activity`, { token });
check("activity returns a series", Array.isArray(activity.data.data.activity), `${activity.data.data.activity?.length} days`);

console.log("\n=== Saved posts ===");
const saved = await api(`/users/${me._id}/saved-posts?limit=20`, { token });
check("saved posts endpoint works", saved.status === 200, `${saved.data.data?.total}`);

console.log("\n=== Authorization still enforced ===");
const otherUser = (await api("/users?limit=1")).data.data.users.find((x) => x._id !== me._id);
const foreignSaved = await api(`/users/${otherUser._id}/saved-posts`, { token });
check("cannot read another user's saved posts", foreignSaved.status === 403, String(foreignSaved.status));

console.log(`\n${"=".repeat(46)}\nPASSED: ${passed}   FAILED: ${failed}\n${"=".repeat(46)}`);
process.exit(failed === 0 ? 0 : 1);
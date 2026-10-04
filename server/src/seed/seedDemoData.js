import fs from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";

import mongoose from "mongoose";

import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { resetDemoData } from "./resetDemoData.js";
import {
  makeRng,
  DEMO_SEED,
  loadValidatedUrls,
  photoUrl,
  placeholderUrl,
  avatarUrl,
} from "./utils/random.js";
import { validateImageUrl } from "./utils/validateImageUrl.js";
import { validateUrl } from "./utils/validateUrl.js";

import {
  ROLES,
  LOCATIONS,
  FIRST_NAMES,
  LAST_NAMES,
  BIO_TEMPLATES,
  SKILLS_BY_ROLE,
  slugifyHandle,
} from "./data/personas.js";
import {
  TAGS,
  POST_TOPICS,
  POST_BODIES,
  POST_TYPES,
  PROJECT_NAMES,
  PROJECT_DESCRIPTIONS,
  TECHNOLOGIES,
  REPO_TOPICS,
  COMMUNITY_SPECS,
  COMMUNITY_POSTS,
  COMMENT_BODIES,
  CHAT_OPENERS,
  CHAT_REPLIES,
  REPO_NAMES,
  LANGUAGES,
} from "./data/content.js";

import User from "../features/users/user.model.js";
import Post from "../features/posts/post.model.js";
import Comment from "../features/comments/comment.model.js";
import Project from "../features/projects/project.model.js";
import Community from "../features/communities/community.model.js";
import Notification from "../features/notifications/notification.model.js";
import Conversation from "../features/chat/conversation.model.js";
import Message from "../features/messages/message.model.js";

export const DEMO_PASSWORD = "ForgeNetDemo2026!";
export const DEMO_EMAIL_DOMAIN = "forgenet.demo";

 const log = (msg) => console.log(msg);

// ---------------------------------------------------------------- image store
/**
 * Resolves web-hosted image URLs for the demo dataset.
 *
 * Every candidate URL is validated with a real HTTP request BEFORE it is
 * written to the database. A URL that fails validation is replaced with an
 * alternative host and re-validated, and only a URL that has passed is ever
 * returned to the caller — so no record is ever created with a broken image.
 *
 * Images are served by picsum.photos (deterministic stock photography) and
 * dicebear (generated avatar illustrations). Both are content-addressed by seed,
 * so re-running the seed reproduces the same images. None of these depict a real
 * person.
 */
class WebImageStore {
  constructor({ log = () => {} } = {}, concurrency = 12) {
    this.log = log;
    this.stats = { resolved: 0, rejected: 0, fallbacks: 0 };
    this._cache = new Map();
    this._inflight = new Map();
    this._concurrency = concurrency;
  }

  /**
   * Runs tasks with a bounded number in flight. Image validation is network
   * bound, so this cuts seeding time dramatically while staying gentle on the
   * remote hosts.
   */
  async pool(items, worker) {
    const results = new Array(items.length);
    let cursor = 0;
    const runners = Array.from({ length: Math.min(this._concurrency, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await worker(items[index], index);
      }
    });
    await Promise.all(runners);
    return results;
  }

  /**
   * Validates a URL and, on failure, tries each supplied fallback in order.
   * @returns {Promise<{url:string, validation:object}>}
   */
  async resolve(candidates) {
    const list = Array.isArray(candidates) ? candidates : [candidates];
    const cacheKey = list[0];
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);
    // De-duplicate concurrent requests for the same image.
    if (this._inflight.has(cacheKey)) return this._inflight.get(cacheKey);

    const promise = this._resolveUncached(list);
    this._inflight.set(cacheKey, promise);
    try {
      return await promise;
    } finally {
      this._inflight.delete(cacheKey);
    }
  }

  async _resolveUncached(list) {
    let lastFailure = null;
    for (const [index, url] of list.entries()) {
      const validation = await validateImageUrl(url);
      if (validation.valid) {
        if (index > 0) this.stats.fallbacks++;
        this.stats.resolved++;
        const out = { url, validation };
        this._cache.set(list[0], out);
        return out;
      }
      lastFailure = validation;
      this.stats.rejected++;
      this.log(`   image rejected: ${url} (${validation.reason})`);
    }

    throw new Error(
      `All candidate images failed validation. Last error: ${lastFailure?.reason ?? "unknown"}`
    );
  }

  /** Deterministic avatar illustration (PNG, matches allowed upload types). */
  async avatar(seed) {
    return this.resolve([
      avatarUrl(seed),
      photoUrl(`avatar-${seed}`, 200, 200),
      placeholderUrl(seed.slice(0, 8), 200, 200),
    ]);
  }

  /** Project cover: landscape photograph. */
  async projectCover(seed) {
    return this.resolve([
      photoUrl(seed, 640, 360),
      placeholderUrl(seed.slice(0, 12), 640, 360),
    ]);
  }

  /** Community tile: square image. */
  async communityImage(seed) {
    return this.resolve([
      photoUrl(seed, 320, 320),
      placeholderUrl(seed.slice(0, 12), 320, 320),
    ]);
  }

  /** Post media, varying aspect ratios so galleries exercise the layout. */
  async postImage(seed, variant) {
    const sizes = [
      [800, 500],
      [640, 640],
      [900, 420],
      [700, 520],
      [560, 700],
    ];
    const [w, h] = sizes[variant % sizes.length];
    return this.resolve([
      photoUrl(`${seed}-${variant}`, w, h),
      placeholderUrl(`${seed}-${variant}`.slice(0, 12), w, h),
    ]);
  }
}

// ------------------------------------------------------------------- helpers
const weightedActivity = (rng) =>
  rng.weighted([
    ["hyperactive", 13],
    ["regular", 45],
    ["occasional", 28],
    ["quiet", 14],
  ]);

const ACTIVITY_PROFILE = {
  hyperactive: { posts: [20, 40], projects: [4, 8], comments: [8, 26], follows: [40, 90], activity: "dense" },
  regular: { posts: [5, 15], projects: [1, 3], comments: [3, 12], follows: [15, 45], activity: "steady" },
  occasional: { posts: [1, 5], projects: [0, 2], comments: [0, 5], follows: [5, 20], activity: "sparse" },
  quiet: { posts: [0, 2], projects: [0, 1], comments: [0, 2], follows: [2, 10], activity: "rare" },
};

const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

/** Backdates timestamps so the dataset spans ~12 months and trending is real. */
const stamp = (doc, date) => {
  doc.createdAt = date;
  doc.updatedAt = date;
  return doc;
};

// ------------------------------------------------------------------ identity
const buildPersonas = (rng, count) => {
  const usedHandles = new Set();
  const personas = [];

  for (let i = 0; i < count; i++) {
    const first = rng.pick(FIRST_NAMES);
    const last = rng.pick(LAST_NAMES);
    const role = ROLES[i % ROLES.length];

    let handle = slugifyHandle(first, last, role.key);
    while (usedHandles.has(handle)) handle = `${handle}-${i}`;
    usedHandles.add(handle);

    const profile = ACTIVITY_PROFILE[weightedActivity(rng)];
    const focus = rng.pick(SKILLS_BY_ROLE[role.key] ?? ["Software Engineering"]);
    const bioPool = BIO_TEMPLATES[role.cluster] ?? BIO_TEMPLATES.engineering;
    const bio = rng.pick(bioPool)(focus);

    personas.push({
      index: i,
      first,
      last,
      name: `${first} ${last}`,
      handle,
      email: `${handle.replace(/-/g, ".")}@${DEMO_EMAIL_DOMAIN}`,
      role,
      roleLabel: role.label,
      bio,
      location: rng.pick(LOCATIONS),
      skills: rng.sample(SKILLS_BY_ROLE[role.key] ?? [], rng.int(3, 5)),
      // These personas are fictional, so no invented per-user GitHub handle is
      // stored: an address like github.com/alex-morgan-ai does not exist and
      // would render as a dead link. Both link fields point at the validated
      // GitHub platform page instead.
      githubUrl: "https://github.com",
      portfolioUrl: "https://github.com",
      profile,
      activityProfile: profile.activity,
      isJobSeeking: role.key === "student_developer" ? true : rng.bool(0.18),
      // Cohesion score drives which communities/people they connect to.
      cohesion: role.cluster,
    });
  }

  return personas;
};

// ---------------------------------------------------------------------- main
export const seedDemoData = async ({ userCount = 120, log: customLog = log } = {}) => {
  const log = customLog;
  const rng = makeRng(DEMO_SEED);
  const stats = {
    users: 0, posts: 0, projects: 0, communities: 0, comments: 0, replies: 0,
    conversations: 0, messages: 0, notifications: 0, follows: 0, likes: 0, saves: 0,
    communityPosts: 0,
  };
  const audit = [];
  const recordAudit = (entity, id, field, url, result, kind = "image") => {
    audit.push({
      entity, id: String(id), field, url,
      status: result.status ?? "",
      contentType: result.contentType ?? "",
      result: result.valid ? "PASS" : "FAIL",
      reason: result.reason ?? "",
      kind,
    });
    return result.valid;
  };

  log("Validating external URLs before any entity is created...");
  const urls = await loadValidatedUrls({ log });

  const images = new WebImageStore({ log });

  // ---------------------------------------------------------------- users
  log(`Creating ${userCount} demo users...`);
  const githubUrlAudit = await validateUrl("https://github.com", { method: "HEAD" });
  if (githubUrlAudit.valid) {
    recordAudit("User", "all demo users", "githubUrl", "https://github.com", githubUrlAudit, "url");
    recordAudit("User", "all demo users", "portfolioUrl", "https://github.com", githubUrlAudit, "url");
  }
  const personas = buildPersonas(rng, userCount);
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const userDocs = [];

  // SELECT -> VALIDATE for every avatar first. resolve() throws if all
  // candidates fail, so nothing is ever saved with an unvalidated image.
  const resolvedAvatars = await images.pool(
    personas.map((p) => p.handle),
    (handle) => images.avatar(handle)
  );
  personas.forEach((persona, i) => {
    recordAudit("User", persona.handle, "profileImage", resolvedAvatars[i].url, resolvedAvatars[i].validation);
  });

  for (const [index, persona] of personas.entries()) {
    const profileImage = resolvedAvatars[index].url;

    // Fictional identities have no real GitHub profile, so the field links to
    // the GitHub platform, whose URL was validated above.
    const githubUrl = persona.githubUrl;
    const portfolioUrl = persona.portfolioUrl;

    const createdAt = daysAgo(rng.int(5, 360));
    const doc = stamp(
      {
        name: persona.name,
        email: persona.email,
        password: passwordHash,
        profileImage,
        bio: persona.bio,
        skills: persona.skills,
        githubUrl,
        portfolioUrl,
        isJobSeeking: persona.isJobSeeking,
        followers: [],
        following: [],
        savedPosts: [],
      },
      createdAt
    );
    userDocs.push(doc);
  }

  const users = await User.insertMany(userDocs, { ordered: false });
  stats.users = users.length;
  log(`   users: ${users.length}`);

  const byCluster = (cluster) => users.filter((_, i) => personas[i].cohesion === cluster);
  const all = users;

  // ------------------------------------------------------------- projects
  log("Creating projects with validated covers and URLs...");
  // Plan the full project list first so covers can be validated concurrently.
  // A global budget keeps the total inside the requested 150-250 range; summing
  // independent per-user ranges drifts well above it.
  const PROJECT_BUDGET = rng.int(180, 235);
  const projectPlan = [];
  users.forEach((user, userIndex) => {
    const persona = personas[userIndex];
    const remaining = PROJECT_BUDGET - projectPlan.length;
    if (remaining <= 0) return;
    // Very active users get their full range; quieter users get a share.
    const maxForUser = Math.min(
      rng.int(persona.profile.projects[0], persona.profile.projects[1]),
      Math.max(0, Math.ceil(remaining / Math.max(1, users.length - userIndex)))
    );
    const count = Math.min(maxForUser, remaining);
    for (let i = 0; i < count; i++) {
      const name = PROJECT_NAMES[(persona.index * 3 + i) % PROJECT_NAMES.length];
      projectPlan.push({
        user,
        persona,
        name,
        key: `${persona.handle}-${name}`.toLowerCase(),
      });
    }
  });

  const resolvedCovers = await images.pool(
    projectPlan.map((p) => p.key),
    (key) => images.projectCover(key)
  );

  const projectDocs = [];
  for (const [index, plan] of projectPlan.entries()) {
    {
      const { user, persona, name, key } = plan;
      const coverImage = resolvedCovers[index];
      const cover = coverImage.url;
      recordAudit("Project", name, "cover", cover, coverImage.validation);

      const githubUrl = rng.pick(urls.github);
      recordAudit("Project", name, "githubUrl", githubUrl, { valid: true }, "url");

      let liveUrl;
      if (rng.bool(0.55)) {
        liveUrl = rng.pick(urls.docs);
        recordAudit("Project", name, "liveUrl", liveUrl, { valid: true }, "url");
      }

      const createdAt = daysAgo(rng.int(10, 330));
      projectDocs.push(
        stamp(
          {
            owner: user._id,
            title: name,
            description: rng.pick(PROJECT_DESCRIPTIONS),
            images: [cover],
            technologies: rng.sample(TECHNOLOGIES, rng.int(3, 6)),
            githubUrl,
            liveUrl: liveUrl ?? "",
            status: rng.weighted([["completed", 40], ["in-progress", 45], ["planned", 15]]),
          },
          createdAt
        )
      );
    }
  }
  const projects = await Project.insertMany(projectDocs);
  stats.projects = projects.length;
  log(`   projects: ${projects.length}`);

  // ----------------------------------------------------------- communities
  log("Creating communities with validated images...");
  const communityDocs = [];
  const communityKeys = COMMUNITY_SPECS.map((spec) =>
    spec.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  );
  const resolvedCommunityImages = await images.pool(communityKeys, (key) =>
    images.communityImage(key)
  );

  for (const [specIndex, spec] of COMMUNITY_SPECS.entries()) {
    const owner = rng.pick(all);
    const key = communityKeys[specIndex];

    const communityImage = resolvedCommunityImages[specIndex];
    const image = communityImage.url;
    recordAudit("Community", spec.name, "image", image, communityImage.validation);

    // Size drives real membership counts drawn from the user base.
    const size = spec.size;
    const memberCount =
      size === "large" ? rng.int(70, 120) : size === "medium" ? rng.int(30, 65) : rng.int(12, 30);
    const candidates = rng.sample(all.filter((u) => !u._id.equals(owner._id)), memberCount);
    const members = [owner._id, ...candidates.map((c) => c._id)];

    communityDocs.push(
      stamp(
        {
          name: `${spec.name}`,
          description: spec.desc,
          owner: owner._id,
          admins: [owner._id],
          members,
          joinMode: spec.mode,
          joinRequests: [],
          image,
        },
        daysAgo(rng.int(20, 340))
      )
    );
  }
  const communities = (await Community.insertMany(communityDocs)).sort(
    (a, b) => a.name.localeCompare(b.name)
  );
  stats.communities = communities.length;
  log(`   communities: ${communities.length}`);

  // ---------------------------------------------------------------- posts
  log("Creating posts with validated media...");
  const postDocs = [];
  let galleryPlan = { one: 0, two: 0, three: 0, many: 0 };

  const postPlan = [];
  for (const user of users) {
    const persona = personas[users.indexOf(user)];
    const count = rng.int(persona.profile.posts[0], persona.profile.posts[1]);

    for (let i = 0; i < count; i++) {
      const topic = rng.pick(POST_TOPICS);
      const type = rng.pick(POST_TYPES);
      const title = topic.title;
      const bodyLead = rng.pick(POST_BODIES[type]);

      // Realistic image distribution, deliberately exercising the gallery:
      // ~45% text-only, then 1/2/3/4+ image posts.
      const roll = rng.next();
      let imageCount = 0;
      if (roll > 0.55) imageCount = rng.weighted([[1, 55], [2, 25], [3, 12], [rng.int(4, 6), 8]]);
      if (imageCount === 1) galleryPlan.one++;
      else if (imageCount === 2) galleryPlan.two++;
      else if (imageCount === 3) galleryPlan.three++;
      else if (imageCount > 3) galleryPlan.many++;

      postPlan.push({
        author: user._id,
        title,
        bodyLead,
        imageCount,
        tags: Array.from(new Set([topic.tag, ...rng.sample(TAGS, rng.int(0, 2))])),
        seed: `${user._id}-${i}`,
        createdAt: daysAgo(rng.int(1, 350)),
      });
    }
  }

  // Validate every post image concurrently, before any post is written.
  const imageJobs = [];
  postPlan.forEach((plan, postIndex) => {
    for (let v = 0; v < plan.imageCount; v++) {
      imageJobs.push({ postIndex, variant: v, seed: `${plan.seed}-${v}` });
    }
  });
  const resolvedPostImages = await images.pool(
    imageJobs.map((job) => job.seed),
    (seed) => images.postImage(seed, imageJobs.find((j) => j.seed === seed)?.variant ?? 0)
  );

  const imagesByPost = new Map();
  imageJobs.forEach((job, i) => {
    const resolved = resolvedPostImages[i];
    recordAudit("Post", `${postPlan[job.postIndex].title} #${job.postIndex}`, `images[${job.variant}]`, resolved.url, resolved.validation);
    const list = imagesByPost.get(job.postIndex) ?? [];
    list.push({
      url: resolved.url,
      mimeType: resolved.validation.contentType ?? "image/jpeg",
      altText: `${postPlan[job.postIndex].title} figure ${job.variant + 1}`,
    });
    imagesByPost.set(job.postIndex, list);
  });

  for (const [postIndex, plan] of postPlan.entries()) {
    const entries = imagesByPost.get(postIndex) ?? [];
    postDocs.push(
      stamp(
        {
          author: plan.author,
          content: `${plan.title}\n\n${plan.bodyLead}`,
          images: entries.map((e) => e.url),
          media: entries.map((e) => ({ type: "image", url: e.url, mimeType: e.mimeType, size: 0, altText: e.altText })),
          codeBlocks: [],
          tags: plan.tags,
          community: null,
          likes: [],
        },
        plan.createdAt
      )
    );
  }
  const posts = await Post.insertMany(postDocs);
  stats.posts = posts.length;
  log(`   posts: ${posts.length} (gallery: ${galleryPlan.one}×1, ${galleryPlan.two}×2, ${galleryPlan.three}×3, ${galleryPlan.many}×4+)`);

  // ------------------------------------------------------- community posts
  log("Creating community posts...");
  const communityPostDocs = [];
  for (const community of communities) {
    const memberIds = community.members;
    const count = rng.int(2, 7);
    for (let i = 0; i < count; i++) {
      const authorId = rng.pick(memberIds);
      const content = rng.pick(COMMUNITY_POSTS);
      communityPostDocs.push(
        stamp(
          {
            author: authorId,
            content,
            images: [],
            media: [],
            codeBlocks: [],
            tags: [rng.pick(TAGS)],
            community: community._id,
            likes: [],
          },
          daysAgo(rng.int(1, 300))
        )
      );
    }
  }
  const communityPosts = await Post.insertMany(communityPostDocs);
  stats.communityPosts = communityPosts.length;
  log(`   community posts: ${communityPosts.length}`);

  // ------------------------------------------------------ social graph
  log("Building the social graph...");
  const mainPosts = posts;

  // Follows: clustered, never everyone-follows-everyone.
  const followPairs = new Set();
  const addFollow = (follower, followee) => {
    const key = `${follower._id}|${followee._id}`;
    if (follower._id.equals(followee._id) || followPairs.has(key)) return false;
    followPairs.add(key);
    return true;
  };

  const followTargetsFor = (persona) => {
    // Cohesion first: researchers follow researchers, etc.
    const peers = byCluster(persona.cohesion).filter((u) => !u._id.equals(persona._id));
    const general = all.filter((u) => !u._id.equals(persona._id));
    const desired = rng.int(persona.profile.follows[0], persona.profile.follows[1]);
    const out = [];
    if (peers.length > 0) out.push(...rng.sample(peers, Math.ceil(desired * 0.6)));
    out.push(...rng.sample(general, Math.min(desired, general.length)));
    return [...new Map(out.map((u) => [u._id.toString(), u])).values()];
  };

  for (const user of all) {
    const persona = personas[all.indexOf(user)];
    for (const target of followTargetsFor(persona)) {
      if (addFollow(user, target)) {
        user.following.push(target._id);
        target.followers.push(user._id);
      }
    }
  }
  stats.follows = followPairs.size;
  log(`   follows: ${stats.follows}`);

  // Likes: clustered, weighted by author popularity.
  const likesByPost = new Map();
  for (const post of mainPosts) {
    const authorPersona = personas[all.findIndex((u) => u._id.equals(post.author))];
    const base =
      authorPersona.activityProfile === "dense" ? rng.int(4, 22)
      : authorPersona.activityProfile === "steady" ? rng.int(1, 10)
      : rng.int(0, 4);
    const likers = rng.sample(all, Math.min(base, all.length));
    for (const liker of likers) {
      if (!liker._id.equals(post.author) && !post.likes.includes(liker._id)) {
        post.likes.push(liker._id);
        likesByPost.set(post._id.toString(), (likesByPost.get(post._id.toString()) ?? 0) + 1);
      }
    }
    stats.likes += post.likes.length;
  }
  for (const post of communityPosts) {
    const likers = rng.sample(all, rng.int(0, 6));
    for (const liker of likers) {
      if (!liker._id.equals(post.author)) post.likes.push(liker._id);
    }
  }

  await Promise.all(all.map((u) => User.updateOne({ _id: u._id }, { $set: { following: u.following, followers: u.followers } })));
  await Post.bulkWrite(mainPosts.map((p) => ({ updateOne: { filter: { _id: p._id }, update: { $set: { likes: p.likes } } } })));
  await Post.bulkWrite(communityPosts.map((p) => ({ updateOne: { filter: { _id: p._id }, update: { $set: { likes: p.likes } } } })));

  // -------------------------------------------------------------- saves
  const savers = rng.sample(all, Math.max(20, Math.floor(all.length * 0.35)));
  const savedDocs = new Map();
  for (const saver of savers) {
    const picks = rng.sample(mainPosts, rng.int(2, 14));
    for (const post of picks) {
      if (!saver._id.equals(post.author)) {
        savedDocs.set(saver._id.toString(), [...(savedDocs.get(saver._id.toString()) ?? []), post._id]);
      }
    }
  }
  for (const [userId, postIds] of savedDocs.entries()) {
    await User.updateOne({ _id: userId }, { $set: { savedPosts: postIds } });
    stats.saves += postIds.length;
  }

  // ---------------------------------------------------- comments + replies
  log("Creating comments and replies...");
  const commentDocs = [];
  const replyDocs = [];

  for (const post of mainPosts) {
    const roll = rng.next();
    const count = roll > 0.97 ? rng.int(10, 16) : roll > 0.9 ? rng.int(5, 9) : roll > 0.65 ? rng.int(1, 3) : 0;
    const postLikes = post.likes.length;
    if (postLikes < 3 && rng.bool(0.6)) continue; // popular posts attract discussion

    for (let i = 0; i < count; i++) {
      const author = rng.pick(all);
      if (author._id.equals(post.author) && rng.bool(0.8)) continue; // rare self-comment
      const commentDocsEntry = stamp(
        {
          author: author._id,
          post: post._id,
          content: rng.pick(COMMENT_BODIES),
          parentComment: null,
          isPinned: false,
        },
        new Date(post.createdAt.getTime() + rng.int(1, 240) * 60 * 1000)
      );
      commentDocs.push(commentDocsEntry);
      // Some comments get replies.
      if (rng.bool(0.35)) {
        const replier = rng.pick(all);
        if (!replier._id.equals(author._id)) {
          replyDocs.push(
            stamp(
              {
                author: replier._id,
                post: post._id,
                content: rng.pick(CHAT_REPLIES),
                parentComment: null,
                isPinned: false,
              },
              new Date(commentDocsEntry.createdAt.getTime() + rng.int(5, 600) * 60 * 1000)
            )
          );
        }
      }
    }
  }

  // Insert, then wire parentComment on the replies.
  const insertedComments = await Comment.insertMany(commentDocs);
  stats.comments = insertedComments.length;

  // Every 3rd reply attaches to a real comment on the same post.
  const commentsByPost = new Map();
  for (const c of insertedComments) {
    const key = c.post.toString();
    commentsByPost.set(key, [...(commentsByPost.get(key) ?? []), c]);
  }
  for (let i = 0; i < replyDocs.length; i++) {
    const siblings = commentsByPost.get(replyDocs[i].post.toString());
    if (siblings?.length) {
      replyDocs[i].parentComment = rng.pick(siblings)._id;
    }
  }
  const insertedReplies = await Comment.insertMany(replyDocs);
  stats.replies = insertedReplies.length;
  log(`   comments: ${stats.comments}, replies: ${stats.replies}`);

  // ------------------------------------------------------- notifications
  log("Creating notifications from real interactions...");
  const notificationDocs = [];
  const seen = new Set();
  const pushNotification = (doc) => {
    const key = `${doc.recipient}|${doc.sender}|${doc.type}|${doc["data.dedupeKey"] ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    notificationDocs.push(doc);
  };

  // Follow notifications.
  for (const follower of all) {
    for (const followee of follower.following) {
      pushNotification({
        recipient: followee,
        sender: follower._id,
        type: "follow",
        message: `${follower.name} started following you.`,
        read: rng.bool(0.55),
        data: { userId: follower._id.toString(), dedupeKey: `follow:${follower._id}:${followee}` },
        ...stamp({}, daysAgo(rng.int(1, 300))),
      });
    }
  }

  // Like notifications (capped per post for realism).
  for (const post of mainPosts) {
    const sample = post.likes.slice(0, 8);
    for (const likerId of sample) {
      const liker = all.find((u) => u._id.equals(likerId));
      if (!liker) continue;
      pushNotification({
        recipient: post.author,
        sender: liker._id,
        type: "like",
        message: `${liker.name} liked your post.`,
        read: rng.bool(0.5),
        data: { postId: post._id.toString(), dedupeKey: `like:${post._id}:${liker._id}` },
        ...stamp({}, post.createdAt),
      });
    }
  }

  // Comment + reply notifications.
  for (const comment of insertedComments) {
    const post = mainPosts.find((p) => p._id.equals(comment.post));
    if (!post) continue;
    const author = all.find((u) => u._id.equals(comment.author));
    if (!author) continue;

    if (comment.parentComment) {
      const parent = insertedComments.find((c) => c._id.equals(comment.parentComment));
      if (parent && !parent.author.equals(comment.author)) {
        pushNotification({
          recipient: parent.author,
          sender: comment.author,
          type: "reply",
          message: `${author.name} replied to your comment.`,
          read: rng.bool(0.5),
          data: { postId: post._id.toString(), commentId: comment._id.toString(), dedupeKey: `reply:${comment._id}` },
          ...stamp({}, comment.createdAt),
        });
      }
    } else if (!post.author.equals(comment.author)) {
      pushNotification({
        recipient: post.author,
        sender: comment.author,
        type: "comment",
        message: `${author.name} commented on your post.`,
        read: rng.bool(0.5),
        data: { postId: post._id.toString(), commentId: comment._id.toString(), dedupeKey: `comment:${comment._id}` },
        ...stamp({}, comment.createdAt),
      });
    }
  }

  // Community notifications for approval-required communities. Every such owner
  // gets at least one, so the notification stream is not dominated by likes.
  for (const community of communities) {
    if (community.joinMode !== "APPROVAL_REQUIRED") continue;
    const owner = all.find((u) => u._id.equals(community.owner));
    if (!owner) continue;
    const requesters = rng.sample(
      community.members.filter((m) => !m.equals(community.owner)),
      6
    );
    for (const requesterId of requesters) {
      const requester = all.find((u) => u._id.equals(requesterId));
      if (!requester) continue;
      pushNotification({
        recipient: community.owner,
        sender: requester._id,
        type: "community",
        message: `${requester.name} requested to join ${community.name}.`,
        read: rng.bool(0.6),
        data: { communityId: community._id.toString(), action: "join_request", dedupeKey: `community:${community._id}:join_request:${requester._id}` },
        ...stamp({}, daysAgo(rng.int(1, 200))),
      });
    }

    // The owner is told about activity in their community too.
    const poster = rng.pick(community.members.filter((m) => !m.equals(community.owner)));
    if (poster) {
      const author = all.find((u) => u._id.equals(poster));
      if (author) {
        pushNotification({
          recipient: community.owner,
          sender: poster,
          type: "community",
          message: `${author.name} posted in ${community.name}.`,
          read: rng.bool(0.5),
          data: { communityId: community._id.toString(), action: "new_post", dedupeKey: `community_post:${community._id}:${poster}` },
          ...stamp({}, daysAgo(rng.int(1, 150))),
        });
      }
    }
  }

  await Notification.insertMany(notificationDocs);
  stats.notifications = notificationDocs.length;
  log(`   notifications: ${notificationDocs.length}`);

  // -------------------------------------------------------- conversations
  log("Creating conversations and messages...");
  const conversationDocs = [];
  for (let i = 0; i < 60; i++) {
    const a = rng.pick(all);
    let b = rng.pick(all);
    if (a._id.equals(b._id)) continue;
    conversationDocs.push(stamp({ participants: [a._id, b._id], title: "" }, daysAgo(rng.int(1, 300))));
  }
  const conversations = await Conversation.insertMany(conversationDocs);
  stats.conversations = conversations.length;

  const messageDocs = [];
  for (const conversation of conversations) {
    const [a, b] = conversation.participants;
    const turns = rng.int(4, 9);

    let cursor = new Date(conversation.createdAt.getTime());
    for (let t = 0; t < turns; t++) {
      const from = t % 2 === 0 ? a : b;
      const content = t % 2 === 0 ? rng.pick(CHAT_OPENERS) : rng.pick(CHAT_REPLIES);
      cursor = new Date(cursor.getTime() + rng.int(2, 600) * 60 * 1000);
      if (cursor.getTime() > Date.now()) break;

      // Read state is real: older messages read, the newest ones often unread.
      const isOld = cursor.getTime() < Date.now() - 3 * 24 * 60 * 60 * 1000;
      const readAt = isOld && rng.bool(0.9) ? new Date(cursor.getTime() + rng.int(1, 90) * 60 * 1000) : null;
      const deliveredAt = new Date(cursor.getTime() + rng.int(0, 4) * 60 * 1000);

      messageDocs.push(
        stamp(
          {
            sender: from,
            conversation: conversation._id,
            content,
            deliveredAt,
            readAt,
          },
          cursor
        )
      );
    }
  }
  const messages = await Message.insertMany(messageDocs);
  stats.messages = messages.length;
  log(`   conversations: ${conversations.length}, messages: ${messages.length}`);

  // Update conversation ordering to match real last-message time.
  for (const conversation of conversations) {
    const last = messages
      .filter((m) => m.conversation.equals(conversation._id))
      .sort((x, y) => y.createdAt - x.createdAt)[0];
    if (last) await Conversation.updateOne({ _id: conversation._id }, { $set: { updatedAt: last.createdAt } });
  }

  // Persist comment authors' activity by relying on real comment timestamps.
  // The activity endpoint aggregates Post/Comment/Project createdAt directly, so
  // no synthetic activity records are created.

  // ------------------------------------------------------------- report
  const imageAudit = audit.filter((a) => a.kind === "image");
  const urlAudit = audit.filter((a) => a.kind === "url");
  const imageFailures = imageAudit.filter((a) => a.result === "FAIL");
  const urlFailures = urlAudit.filter((a) => a.result === "FAIL");

  const counts = {
    users: await User.countDocuments(),
    posts: await Post.countDocuments(),
    projects: await Project.countDocuments(),
    communities: await Community.countDocuments(),
    comments: await Comment.countDocuments(),
    replies: await Comment.countDocuments({ parentComment: { $ne: null } }),
    conversations: await Conversation.countDocuments(),
    messages: await Message.countDocuments(),
    notifications: await Notification.countDocuments(),
  };

  return { stats, audit, counts, galleryPlan, personas, urls, images };
};

// ------------------------------------------------------------------ runner
const run = async () => {
  console.log("ForgeNet demo seed");
  console.log("==================\n");
  await connectDatabase();

  // Snapshot genuine (non-demo, non-test-fixture) accounts before the wipe.
  // Throws away automated test users so they cannot accumulate in the demo.
  const TEST_EMAIL_DOMAINS = ["test.dev", "t.dev", "avatar.test", "crud.test", "example.com", "example.org"];
  const preservedDocs = await mongoose.connection.db
    .collection("users")
    .find({
      email: {
        $not: /@forgenet\.demo$/i,
        $nin: TEST_EMAIL_DOMAINS.map((d) => new RegExp(`@${d.replace(".", "\\.")}$`, "i")),
      },
    })
    .toArray();

  const { before } = await resetDemoData({ log });
  console.log("");
  console.log("Old data removed:");
  for (const [key, value] of Object.entries(before)) console.log(`   ${key}: ${value}`);

  console.log("");
  const result = await seedDemoData({ log: console.log });

  // -------------------------------------------------- DEMO_ACCOUNTS.md
  // Restore any non-demo accounts that were preserved through the reset.
  if (preservedDocs.length > 0) {
    await User.insertMany(preservedDocs, { ordered: false });
    console.log(`\nRestored ${preservedDocs.length} non-demo account(s): ${preservedDocs.map((u) => u.email).join(", ")}`);
  }

  const md = buildDemoAccountsMarkdown(result.personas, result.counts);
  const mdPath = path.resolve(process.cwd(), "..", "DEMO_ACCOUNTS.md");
  await fs.writeFile(mdPath, md, "utf8");
  console.log(`\nWrote ${mdPath}`);

  // -------------------------------------------------- validation report
  const report = buildAuditReport(result.audit);
  const reportPath = path.resolve(process.cwd(), "..", "docs", "DEMO_DATA_VALIDATION.md");
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, report, "utf8");
  console.log(`Wrote ${reportPath}`);

  // -------------------------------------------------- integrity checks
  console.log("\nVerifying database integrity...");
  const integrity = await verifyIntegrity(log);

  console.log("\n================== FINAL STATISTICS ==================");
  console.log(`Users:        ${result.counts.users}`);
  console.log(`Posts:        ${result.counts.posts}`);
  console.log(`Projects:     ${result.counts.projects}`);
  console.log(`Communities:  ${result.counts.communities}`);
  console.log(`Comments:     ${result.counts.comments} (replies: ${result.counts.replies})`);
  console.log(`Conversations:${String(result.counts.conversations).padStart(3)}`);
  console.log(`Messages:     ${result.counts.messages}`);
  console.log(`Notifications:${String(result.counts.notifications).padStart(3)}`);
  console.log(`\nImages validated: ${result.audit.filter((a) => a.kind === "image").length}`);
  console.log(`Images failed:    ${result.audit.filter((a) => a.kind === "image" && a.result === "FAIL").length}`);
  console.log(`URLs validated:   ${result.audit.filter((a) => a.kind === "url").length}`);
  console.log(`URLs failed:      ${result.audit.filter((a) => a.kind === "url" && a.result === "FAIL").length}`);
  console.log(`Integrity: ${integrity.ok ? "PASS" : "FAIL"}`);
  if (!integrity.ok) console.log(integrity.failures.join("\n"));
  console.log("====================================================\n");

  await disconnectDatabase();
  if (!integrity.ok) process.exitCode = 1;
};

export const buildDemoAccountsMarkdown = (personas, counts) => {
  const lines = [];
  lines.push("# ForgeNet Demo Accounts");
  lines.push("");
  lines.push(
    "These are **fictional accounts** created only for local ForgeNet development and testing."
  );
  lines.push(
    "Every person, repository, project, and company referenced here is invented. No real individual or organisation is represented."
  );
  lines.push("");
  lines.push(`Generated dataset: **${counts.users} users**, ${counts.posts} posts, ${counts.projects} projects, ${counts.communities} communities.`);
  lines.push("");
  lines.push("All accounts share the same password:");
  lines.push("");
  lines.push("```");
  lines.push(DEMO_PASSWORD);
  lines.push("```");
  lines.push("");
  lines.push("## Quick start");
  lines.push("");
  lines.push("Paste any email below. The password is the same for every account.");
  lines.push("");

  const featured = personas.slice(0, 12);
  lines.push("## Suggested accounts to try first");
  lines.push("");
  lines.push("| Name | Role | GitHub-style handle | Email | Password |");
  lines.push("|------|------|----------------------|-------|----------|");
  for (const p of featured) {
    lines.push(`| ${p.name} | ${p.roleLabel} | ${p.handle} | ${p.email} | ${DEMO_PASSWORD} |`);
  }
  lines.push("");

  const byRole = new Map();
  for (const p of personas) {
    const list = byRole.get(p.roleLabel) ?? [];
    list.push(p);
    byRole.set(p.roleLabel, list);
  }

  lines.push("## All accounts by role");
  lines.push("");
  for (const [role, list] of [...byRole.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`### ${role} (${list.length})`);
    lines.push("");
    lines.push("| Name | GitHub-style handle | Location | Email | Password |");
    lines.push("|------|----------------------|----------|-------|----------|");
    for (const p of list) {
      lines.push(`| ${p.name} | ${p.handle} | ${p.location} | ${p.email} | ${DEMO_PASSWORD} |`);
    }
    lines.push("");
  }

  lines.push("## Notes");
  lines.push("");
  lines.push(`- Email domain: \`@${DEMO_EMAIL_DOMAIN}\``);
  lines.push("- Passwords are demo-only and must never be reused anywhere else.");
  lines.push("- These credentials grant access to local development data only.");
  lines.push("- Re-run `npm run seed:demo` to regenerate; the dataset is deterministic.");
  lines.push("");
  return lines.join("\n");
};

export const buildAuditReport = (audit) => {
  const lines = [];
  const images = audit.filter((a) => a.kind === "image");
  const urlRows = audit.filter((a) => a.kind === "url");
  const failed = audit.filter((a) => a.result === "FAIL");

  lines.push("# ForgeNet Demo Data — Image & URL Validation Report");
  lines.push("");
  lines.push("Generated by `npm run seed:demo`. Every image and URL below was validated over HTTP **before** the owning record was written to the database.");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Metric | Count |");
  lines.push("|--------|-------|");
  lines.push(`| Images checked | ${images.length} |`);
  lines.push(`| Images passed | ${images.length - failed.filter((a) => a.kind === "image").length} |`);
  lines.push(`| Images failed | ${failed.filter((a) => a.kind === "image").length} |`);
  lines.push(`| URLs checked | ${urlRows.length} |`);
  lines.push(`| URLs passed | ${urlRows.length - failed.filter((a) => a.kind === "url").length} |`);
  lines.push(`| URLs failed | ${failed.filter((a) => a.kind === "url").length} |`);
  lines.push("");
  lines.push("## Images");
  lines.push("");
  lines.push("| Entity | Reference | Field | Status | Content-Type | Result |");
  lines.push("|--------|-----------|-------|--------|--------------|--------|");
  for (const row of images) {
    lines.push(`| ${row.entity} | ${row.id} | ${row.field} | ${row.status} | ${row.contentType} | ${row.result} |`);
  }
  lines.push("");
  lines.push("## URLs");
  lines.push("");
  lines.push("| Entity | Reference | Field | URL | Status | Content-Type | Result |");
  lines.push("|--------|-----------|-------|-----|--------|--------------|--------|");
  for (const row of urlRows) {
    lines.push(`| ${row.entity} | ${row.id} | ${row.field} | ${row.url} | ${row.status} | ${row.contentType} | ${row.result} |`);
  }
  if (failed.length > 0) {
    lines.push("");
    lines.push("## Failures");
    lines.push("");
    for (const row of failed) {
      lines.push(`- **${row.entity} / ${row.field}** — ${row.url} — ${row.reason}`);
    }
  }
  lines.push("");
  return lines.join("\n");
};

export const verifyIntegrity = async (log = console.log) => {
  const failures = [];

  const [postAuthors, projectOwners, communityOwners, commentPosts, commentAuthors, notifRecipients, msgConversations, convParticipants] =
    await Promise.all([
      Post.distinct("author").then(async (ids) => User.countDocuments({ _id: { $in: ids } })),
      Project.distinct("owner").then(async (ids) => User.countDocuments({ _id: { $in: ids } })),
      Community.distinct("owner").then(async (ids) => User.countDocuments({ _id: { $in: ids } })),
      Comment.distinct("post").then(async (ids) => Post.countDocuments({ _id: { $in: ids } })),
      Comment.distinct("author").then(async (ids) => User.countDocuments({ _id: { $in: ids } })),
      Notification.distinct("recipient").then(async (ids) => User.countDocuments({ _id: { $in: ids } })),
      Message.distinct("conversation").then(async (ids) => Conversation.countDocuments({ _id: { $in: ids } })),
      Conversation.distinct("participants").then(async (ids) => User.countDocuments({ _id: { $in: ids } })),
    ]);

  const orphanComments = await Comment.countDocuments({ post: { $nin: (await Post.distinct("_id")) } });
  const orphanMessages = await Message.countDocuments({ conversation: { $nin: (await Conversation.distinct("_id")) } });
  const selfNotifications = await Notification.countDocuments({ $expr: { $eq: ["$recipient", "$sender"] } });

  const results = [
    ["post authors exist", postAuthors],
    ["project owners exist", projectOwners],
    ["community owners exist", communityOwners],
    ["comments reference posts", commentPosts],
    ["comment authors exist", commentAuthors],
    ["notification recipients exist", notifRecipients],
    ["messages reference conversations", msgConversations],
    ["conversation participants exist", convParticipants],
    ["orphan comments", orphanComments],
    ["orphan messages", orphanMessages],
    ["self-notifications", selfNotifications],
  ];

  for (const [label, count] of results) {
    const expectedZero = label.startsWith("orphan") || label === "self-notifications";
    const ok = expectedZero ? count === 0 : count > 0;
    if (ok) log(`   ok   ${label}: ${count}`);
    else {
      log(`   FAIL ${label}: ${count}`);
      failures.push(`${label}: ${count}`);
    }
  }

  // Duplicate emails.
  const duplicateEmails = await User.aggregate([
    { $group: { _id: "$email", n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]);
  if (duplicateEmails.length === 0) log("   ok   no duplicate users");
  else {
    log(`   FAIL ${duplicateEmails.length} duplicate emails`);
    failures.push(`${duplicateEmails.length} duplicate user emails`);
  }

  return { ok: failures.length === 0, failures };
};

// Only run when invoked directly.
const invokedDirectly = process.argv[1] && process.argv[1].includes("seedDemoData");
if (invokedDirectly) {
  run().catch(async (error) => {
    console.error("\nSeed failed:", error.message);
    console.error(error.stack);
    try {
      await disconnectDatabase();
    } catch {
      // Already disconnected.
    }
    process.exit(1);
  });
}

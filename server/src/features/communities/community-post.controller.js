import Post from "../posts/post.model.js";
import Community from "./community.model.js";
import { createNotification } from "../notifications/notification.service.js";

// owner/admins/members are raw ObjectIds before .populate() and documents after.
const idOf = (value) => (value?._id ?? value)?.toString();

const isMember = (community, userId) =>
    (community.members || []).some((id) => idOf(id) === userId.toString());

/**
 * Server-side authorization for community posts: only the owner, an admin, or
 * a member may post. The React UI also hides this, but the API is the gate.
 */
export const canPostInCommunity = (community, userId) =>
    isMember(community, userId) ||
    (community.admins || []).some((id) => idOf(id) === userId.toString()) ||
    idOf(community.owner) === userId.toString();

const parsePagination = (req, defaultLimit = 10, maxLimit = 50) => {
    const rawLimit = Number.parseInt(req.query.limit ?? String(defaultLimit), 10);
    const rawSkip = Number.parseInt(req.query.skip ?? "0", 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : defaultLimit;
    const skip = Number.isFinite(rawSkip) && rawSkip >= 0 ? rawSkip : 0;
    return { limit, skip };
};

export const getCommunityPosts = async (req, res) => {
    const { limit, skip } = parsePagination(req);
    // The route is mounted as /communities/:id/posts, so the param is `id`.
    const communityId = req.params.communityId || req.params.id;
    const filter = { community: communityId };
    const total = await Post.countDocuments(filter);
    const posts = await Post.find(filter).populate("author", "name profileImage").sort({ createdAt: -1 }).skip(skip).limit(limit);
    return res.json({ success: true, data: { posts, total, limit, skip } });
};

export const createCommunityPost = async (req, res) => {
    const communityId = req.params.communityId || req.params.id;
    const community = await Community.findById(communityId);
    if (!community) return res.status(404).json({ success: false, message: "Community not found" });
    if (!canPostInCommunity(community, req.user._id))
        return res.status(403).json({ success: false, message: "Join the community before posting" });

    const content = String(req.body?.content ?? "").trim();
    if (!content) return res.status(400).json({ success: false, message: "Post content is required" });
    if (content.length > 3000)
        return res.status(400).json({ success: false, message: "Post content cannot exceed 3000 characters" });

    const post = await Post.create({ ...req.body, content, author: req.user._id, community: community._id });

    // Notify community admins/owner of new activity (skipped if the author is one of them).
    const moderators = [community.owner, ...(community.admins || [])];
    await Promise.all(
        [...new Map(moderators.map((id) => [id.toString(), id])).values()]
            .filter((id) => id.toString() !== req.user._id.toString())
            .map((id) =>
                createNotification({
                    recipientId: id,
                    senderId: req.user._id,
                    type: "community",
                    message: `${req.user.name} posted in ${community.name}.`,
                    data: { communityId: community._id.toString(), postId: post._id.toString() },
                    dedupeKey: `community_post:${post._id}`
                })
            )
    );

    return res.status(201).json({ success: true, data: { post } });
};

export const updateCommunityPost = async (req, res) => {
    const post = await Post.findOne({ _id: req.params.id, community: { $ne: null } });
    if (!post) return res.status(404).json({ success: false, message: "Community post not found" });
    if (post.author.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: "You are not authorized to modify this post" });
    Object.assign(post, { content: req.body?.content, images: req.body?.images, codeBlocks: req.body?.codeBlocks, tags: req.body?.tags });
    await post.save();
    return res.json({ success: true, data: { post } });
};

export const deleteCommunityPost = async (req, res) => {
    const post = await Post.findOne({ _id: req.params.id, community: { $ne: null } });
    if (!post) return res.status(404).json({ success: false, message: "Community post not found" });
    if (post.author.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: "You are not authorized to modify this post" });
    await post.deleteOne();
    return res.json({ success: true, message: "Community post deleted successfully" });
};
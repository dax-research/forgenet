import Post from "../posts/post.model.js";
import Community from "./community.model.js";

const isMember = (community, userId) => community.members.some((id) => id.toString() === userId.toString());

export const getCommunityPosts = async (req, res) => {
    const posts = await Post.find({ community: req.params.communityId }).populate("author", "name profileImage").sort({ createdAt: -1 });
    return res.json({ success: true, data: { posts } });
};

export const createCommunityPost = async (req, res) => {
    const community = await Community.findById(req.params.communityId);
    if (!community) return res.status(404).json({ success: false, message: "Community not found" });
    if (!isMember(community, req.user._id)) return res.status(403).json({ success: false, message: "Join the community before posting" });
    const post = await Post.create({ ...req.body, author: req.user._id, community: community._id });
    return res.status(201).json({ success: true, data: { post } });
};

export const updateCommunityPost = async (req, res) => {
    const post = await Post.findOneAndUpdate({ _id: req.params.id, author: req.user._id, community: { $ne: null } }, { content: req.body.content, images: req.body.images, codeBlocks: req.body.codeBlocks, tags: req.body.tags }, { new: true, runValidators: true });
    if (!post) return res.status(404).json({ success: false, message: "Community post not found" });
    return res.json({ success: true, data: { post } });
};

export const deleteCommunityPost = async (req, res) => {
    const post = await Post.findOneAndDelete({ _id: req.params.id, author: req.user._id, community: { $ne: null } });
    if (!post) return res.status(404).json({ success: false, message: "Community post not found" });
    return res.json({ success: true, message: "Community post deleted successfully" });
};
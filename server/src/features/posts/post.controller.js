import mongoose from "mongoose";
import Post from "./post.model.js";
import User from "../users/user.model.js";
import { uploadMediaFiles } from "../../services/storage/index.js";
import { createNotification } from "../notifications/notification.service.js";

const parsePagination = (req, defaultLimit = 10, maxLimit = 50) => {
    const rawLimit = Number.parseInt(req.query.limit ?? String(defaultLimit), 10);
    const rawSkip = Number.parseInt(req.query.skip ?? "0", 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : defaultLimit;
    const skip = Number.isFinite(rawSkip) && rawSkip >= 0 ? rawSkip : 0;
    return { limit, skip };
};

const parseJsonField = (field, fallback = []) => {
    if (!field) return fallback;
    if (typeof field === "string") {
        try {
            return JSON.parse(field);
        } catch {
            return fallback;
        }
    }
    return field;
};

/** Best-effort mime type from an image URL, used for URL-created media. */
const guessMimeType = (url = "") => {
    const clean = String(url).split("?")[0].toLowerCase();
    if (clean.endsWith(".png")) return "image/png";
    if (clean.endsWith(".webp")) return "image/webp";
    if (clean.endsWith(".gif")) return "image/gif";
    return "image/jpeg";
};

// Create a post
export const createPost = async (req, res) => {
    try {
        let { content, images, media, codeBlocks, tags } = req.body;

        content = content !== undefined ? String(content).trim() : "";
        if (!content) {
            return res.status(400).json({
                success: false,
                message: "Post content is required"
            });
        }

        if (content.length > 3000) {
            return res.status(400).json({
                success: false,
                message: "Post content cannot exceed 3000 characters"
            });
        }

        codeBlocks = parseJsonField(codeBlocks, []);
        tags = parseJsonField(tags, []);
        images = parseJsonField(images, []);
        media = parseJsonField(media, []);

        // Keep `media` in step with `images`. Posts can be created from image
        // URLs as well as uploads, and the gallery renders from whichever is
        // present, so both must describe the same set.
        const mediaByUrl = new Map(
            (Array.isArray(media) ? media : []).map((m) => [m?.url, m]).filter(([url]) => url)
        );
        media = (Array.isArray(images) ? images : [])
            .map((url) => {
                const existing = mediaByUrl.get(url);
                if (existing) return existing;
                return {
                    type: "image",
                    url,
                    mimeType: guessMimeType(url),
                    size: 0,
                    altText: ""
                };
            });

        if (req.files && req.files.length > 0) {
            const uploadedMedia = await uploadMediaFiles(req.files);
            for (const item of uploadedMedia) {
                const absolute = `${req.protocol}://${req.get("host")}${item.url}`;
                media.push({
                    type: "image",
                    url: absolute,
                    filename: item.filename,
                    mimeType: item.mimeType,
                    size: item.size,
                    altText: ""
                });
                images.push(absolute);
            }
        }

        if (images.length > 20) {
            return res.status(400).json({
                success: false,
                message: "A post can have at most 20 images."
            });
        }

        const post = await Post.create({
            author: req.user._id,
            content,
            images,
            media,
            codeBlocks,
            tags
        });

        return res.status(201).json({
            success: true,
            message: "Post created successfully",
            data: { post }
        });
    } catch (error) {
        return res.status(error.name === "ValidationError" ? 400 : 500).json({
            success: false,
            message: error.name === "ValidationError" ? error.message : "Internal server error"
        });
    }
};


// Get all posts
export const getPosts = async (req, res) => {
    try {
        const { limit, skip } = parsePagination(req);
        
        let query = {};
        if (req.query.tag) {
            const tagPattern = new RegExp("^" + req.query.tag.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i");
            query.tags = tagPattern;
        }

        const total = await Post.countDocuments(query);
        const posts = await Post.find(query)
            .populate("author", "name profileImage")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        return res.status(200).json({
            success: true,
            data: { posts, total, limit, skip }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// Get one post
export const getPost = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid post ID" });
        }

        const post = await Post.findById(req.params.id)
            .populate("author", "name profileImage");

        if (!post) {
            return res.status(404).json({
                success: false,
                message: "Post not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: { post }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// Update a post
export const updatePost = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid post ID" });
        }

        let { content, images, media, codeBlocks, tags } = req.body ?? {};

        if (content !== undefined) {
            content = String(content).trim();
            if (!content) {
                return res.status(400).json({
                    success: false,
                    message: "Post content cannot be empty"
                });
            }
            if (content.length > 3000) {
                return res.status(400).json({
                    success: false,
                    message: "Post content cannot exceed 3000 characters"
                });
            }
        }

        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json({
                success: false,
                message: "Post not found"
            });
        }

        if (post.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to modify this post"
            });
        }

        const updates = {};
        if (content !== undefined) updates.content = content;
        if (codeBlocks !== undefined) updates.codeBlocks = parseJsonField(codeBlocks, post.codeBlocks);
        if (tags !== undefined) updates.tags = parseJsonField(tags, post.tags);

        if (images !== undefined) {
            // When editing with uploads, the client sends the images it wants to
            // KEEP as a JSON string, and any new files arrive on req.files.
            let kept = parseJsonField(images, post.images);
            if (!Array.isArray(kept)) kept = post.images;
            kept = kept.map((entry) => (typeof entry === "string" ? entry : entry?.url)).filter(Boolean);

            if (req.files && req.files.length > 0) {
                const uploadedMedia = await uploadMediaFiles(req.files);
                for (const item of uploadedMedia) {
                    kept.push(`${req.protocol}://${req.get("host")}${item.url}`);
                }
                if (kept.length > 20) {
                    return res.status(400).json({
                        success: false,
                        message: "A post can have at most 20 images."
                    });
                }
            }

            updates.images = kept;
            updates.media = kept.map((url, index) => ({
                type: "image",
                url,
                mimeType: "image/jpeg",
                size: 0,
                altText: post.media?.[index]?.altText || ""
            }));
        }

        Object.assign(post, updates);
        await post.save();

        return res.status(200).json({
            success: true,
            message: "Post updated successfully",
            data: { post }
        });
    } catch (error) {
        return res.status(error.name === "ValidationError" ? 400 : 500).json({
            success: false,
            message: error.name === "ValidationError" ? error.message : "Internal server error"
        });
    }
};


// Delete a post
export const deletePost = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid post ID" });
        }

        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json({
                success: false,
                message: "Post not found"
            });
        }

        if (post.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to modify this post"
            });
        }

        await post.deleteOne();

        // Clean up associated comments and saved posts
        const Comment = mongoose.model("Comment");
        await Comment.deleteMany({ post: post._id });
        await User.updateMany({ savedPosts: post._id }, { $pull: { savedPosts: post._id } });

        return res.status(200).json({
            success: true,
            message: "Post deleted successfully"
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const searchPosts = async (req, res) => {
    const query = req.query.q?.trim();
    if (!query) return res.status(400).json({ success: false, message: "Search query is required" });
    const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const posts = await Post.find({ $or: [{ content: pattern }, { tags: pattern }] })
        .populate("author", "name profileImage").sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: { posts } });
};

export const savePost = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid post ID" });
        }
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ success: false, message: "Post not found" });
        await User.findByIdAndUpdate(req.user._id, { $addToSet: { savedPosts: post._id } });
        return res.status(200).json({ success: true, message: "Post saved successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const unsavePost = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid post ID" });
        }
        await User.findByIdAndUpdate(req.user._id, { $pull: { savedPosts: req.params.id } });
        return res.status(200).json({ success: true, message: "Post removed from saved posts" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const likePost = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid post ID" });
        }

        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found" });
        }

        const userId = req.user._id;
        const alreadyLiked = post.likes.some((id) => id.toString() === userId.toString());

        if (!alreadyLiked) {
            post.likes.push(userId);
            await post.save();

            await createNotification({
                recipientId: post.author,
                senderId: userId,
                type: "like",
                message: `${req.user.name} liked your post.`,
                data: { postId: post._id.toString() },
                dedupeKey: `like:${post._id}:${userId}`
            });
        }

        return res.status(200).json({
            success: true,
            message: "Post liked successfully",
            data: {
                postId: post._id,
                likeCount: post.likes.length,
                isLiked: true,
                likes: post.likes
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const unlikePost = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid post ID" });
        }

        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found" });
        }

        const userId = req.user._id;
        post.likes = post.likes.filter((id) => id.toString() !== userId.toString());
        await post.save();

        return res.status(200).json({
            success: true,
            message: "Post unliked successfully",
            data: {
                postId: post._id,
                likeCount: post.likes.length,
                isLiked: false,
                likes: post.likes
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const getTrendingTopics = async (req, res) => {
    try {
        const rawLimit = Number.parseInt(req.query.limit ?? "10", 10);
        const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 20) : 10;

        const trending = await Post.aggregate([
            { $match: { tags: { $exists: true, $type: "array", $ne: [] } } },
            // Project deduplicated lowercase tags per post to prevent duplicate tags in a single post inflating the count
            {
                $project: {
                    uniqueTags: {
                        $setUnion: [
                            {
                                $map: {
                                    input: "$tags",
                                    as: "tag",
                                    in: { $toLower: { $trim: { input: "$$tag" } } }
                                }
                            },
                            []
                        ]
                    }
                }
            },
            { $unwind: "$uniqueTags" },
            { $match: { uniqueTags: { $ne: "" } } },
            {
                $group: {
                    _id: "$uniqueTags",
                    postCount: { $sum: 1 }
                }
            },
            { $sort: { postCount: -1, _id: 1 } },
            { $limit: limit },
            {
                $project: {
                    _id: 0,
                    tag: "$_id",
                    postCount: 1
                }
            }
        ]);

        return res.status(200).json({
            success: true,
            data: { trending }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
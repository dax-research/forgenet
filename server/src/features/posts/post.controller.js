import mongoose from "mongoose";
import Post from "./post.model.js";
import User from "../users/user.model.js";
import { uploadMediaFiles } from "../../services/storage/index.js";

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

        if (req.files && req.files.length > 0) {
            const uploadedMedia = await uploadMediaFiles(req.files);
            for (const item of uploadedMedia) {
                media.push({
                    type: "image",
                    url: item.url,
                    filename: item.filename,
                    mimeType: item.mimeType,
                    size: item.size,
                    altText: ""
                });
                images.push(item.url);
            }
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
        const total = await Post.countDocuments();
        const posts = await Post.find()
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

        let { content, images, media, codeBlocks, tags } = req.body;

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
        if (images !== undefined) updates.images = parseJsonField(images, post.images);
        if (media !== undefined) updates.media = parseJsonField(media, post.media);
        if (codeBlocks !== undefined) updates.codeBlocks = parseJsonField(codeBlocks, post.codeBlocks);
        if (tags !== undefined) updates.tags = parseJsonField(tags, post.tags);

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
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ success: false, message: "Invalid post ID" });
    }
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { savedPosts: post._id } });
    return res.status(200).json({ success: true, message: "Post saved successfully" });
};

export const unsavePost = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ success: false, message: "Invalid post ID" });
    }
    await User.findByIdAndUpdate(req.user._id, { $pull: { savedPosts: req.params.id } });
    return res.status(200).json({ success: true, message: "Post removed from saved posts" });
};
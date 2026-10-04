import mongoose from "mongoose";
import Comment from "./comment.model.js";
import Post from "../posts/post.model.js";
import { createNotification } from "../notifications/notification.service.js";

const parsePagination = (req, defaultLimit = 10, maxLimit = 50) => {
    const rawLimit = Number.parseInt(req.query.limit ?? String(defaultLimit), 10);
    const rawSkip = Number.parseInt(req.query.skip ?? "0", 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : defaultLimit;
    const skip = Number.isFinite(rawSkip) && rawSkip >= 0 ? rawSkip : 0;
    return { limit, skip };
};

// Create comment
export const createComment = async (req, res) => {
    try {
        const post = req.params.postId || req.body.post;
        const { content, parentComment } = req.body;

        if (!post || !mongoose.isValidObjectId(post)) {
            return res.status(400).json({ success: false, message: "A valid post ID is required" });
        }
        if (!content || !String(content).trim()) {
            return res.status(400).json({ success: false, message: "Comment content is required" });
        }

        const parent = parentComment ? await Comment.findById(parentComment) : null;
        const comment = await Comment.create({ author: req.user._id, post, content: String(content).trim(), parentComment });

        const postDoc = await Post.findById(post).select("author");
        if (postDoc) {
            // A reply notifies the comment author; otherwise the post author.
            if (parent) {
                await createNotification({
                    recipientId: parent.author,
                    senderId: req.user._id,
                    type: "reply",
                    message: `${req.user.name} replied to your comment.`,
                    data: { postId: post.toString(), commentId: comment._id.toString() },
                    dedupeKey: `reply:${comment._id}`
                });
            } else {
                await createNotification({
                    recipientId: postDoc.author,
                    senderId: req.user._id,
                    type: "comment",
                    message: `${req.user.name} commented on your post.`,
                    data: { postId: post.toString(), commentId: comment._id.toString() },
                    dedupeKey: `comment:${comment._id}`
                });
            }
        }

        return res.status(201).json({
            success: true,
            message: "Comment created successfully",
            data: { comment }
        });
    } catch (error) {
        return res.status(error.name === "ValidationError" ? 400 : 500).json({
            success: false,
            message: error.name === "ValidationError" ? error.message : "Internal server error"
        });
    }
};


// Get comments of a post
export const getCommentsByPost = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.postId)) {
            return res.status(400).json({ success: false, message: "Invalid post ID" });
        }

        const { limit, skip } = parsePagination(req);
        const query = { post: req.params.postId };
        const total = await Comment.countDocuments(query);
        const comments = await Comment.find(query)
            .populate("author", "name profileImage")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        return res.status(200).json({
            success: true,
            data: { comments, total, limit, skip }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// Update comment
export const updateComment = async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id);

        if (!comment) {
            return res.status(404).json({
                success: false,
                message: "Comment not found"
            });
        }

        if (comment.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to modify this comment"
            });
        }

        comment.content = req.body.content;
        await comment.save();

        return res.status(200).json({
            success: true,
            message: "Comment updated successfully",
            data: { comment }
        });
    } catch (error) {
        return res.status(error.name === "ValidationError" ? 400 : 500).json({
            success: false,
            message: error.name === "ValidationError" ? error.message : "Internal server error"
        });
    }
};


// Delete comment
export const deleteComment = async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id);

        if (!comment) {
            return res.status(404).json({
                success: false,
                message: "Comment not found"
            });
        }

        if (comment.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to modify this comment"
            });
        }

        await comment.deleteOne();

        // Delete all nested replies
        await Comment.deleteMany({ parentComment: comment._id });

        return res.status(200).json({
            success: true,
            message: "Comment deleted successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
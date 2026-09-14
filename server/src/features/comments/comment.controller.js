import mongoose from "mongoose";
import Comment from "./comment.model.js";

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
        const comment = await Comment.create({ author: req.user._id, post, content, parentComment });

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
        const comment = await Comment.findOneAndUpdate(
            { _id: req.params.id, author: req.user._id },
            { content: req.body.content },
            {
                new: true,
                runValidators: true
            }
        );

        if (!comment) {
            return res.status(404).json({
                success: false,
                message: "Comment not found"
            });
        }

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
        const comment = await Comment.findOneAndDelete({ _id: req.params.id, author: req.user._id });

        if (!comment) {
            return res.status(404).json({
                success: false,
                message: "Comment not found"
            });
        }

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
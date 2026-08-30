import mongoose from "mongoose";
import Comment from "./comment.model.js";
import Post from "../posts/post.model.js";

const isOwnerOfComment = async (userId, commentId) => {
    const comment = await Comment.findById(commentId);
    if (!comment) return false;
    return comment.author.toString() === userId.toString();
};

// Create comment
export const createComment = async (req, res) => {
    try {
        const post = req.params.postId || req.body.post;
        const { content, parentComment } = req.body;

        if (!post || !mongoose.isValidObjectId(post)) {
            return res.status(400).json({ success: false, message: "Invalid post ID" });
        }

        if (!content || !content.trim()) {
            return res.status(400).json({ success: false, message: "Comment content is required" });
        }

        const postExists = await Post.findById(post);
        if (!postExists) {
            return res.status(404).json({ success: false, message: "Post not found" });
        }

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

        const comments = await Comment.find({
            post: req.params.postId
        })
            .populate("author", "name profileImage")
            .sort({ isPinned: -1, createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: { comments }
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
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid comment ID" });
        }

        if (!req.body.content || !req.body.content.trim()) {
            return res.status(400).json({ success: false, message: "Comment content is required" });
        }

        const comment = await Comment.findOneAndUpdate(
            { _id: req.params.id, author: req.user._id },
            { content: req.body.content.trim() },
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
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid comment ID" });
        }

        const comment = await Comment.findOneAndDelete({ _id: req.params.id, author: req.user._id });

        if (!comment) {
            return res.status(404).json({
                success: false,
                message: "Comment not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Comment deleted successfully"
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

export const pinComment = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid comment ID" });
        }

        const comment = await Comment.findById(req.params.id);
        if (!comment) {
            return res.status(404).json({ success: false, message: "Comment not found" });
        }

        const post = await Post.findById(comment.post);
        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found" });
        }

        if (post.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: "Only the post owner can pin comments" });
        }

        if (comment.isPinned) {
            return res.status(409).json({ success: false, message: "Comment is already pinned" });
        }

        const updatedComment = await Comment.findByIdAndUpdate(
            req.params.id,
            { $set: { isPinned: true } },
            { new: true, runValidators: true }
        ).populate("author", "name profileImage");

        return res.status(200).json({
            success: true,
            message: "Comment pinned successfully",
            data: { comment: updatedComment }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const unpinComment = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid comment ID" });
        }

        const comment = await Comment.findById(req.params.id);
        if (!comment) {
            return res.status(404).json({ success: false, message: "Comment not found" });
        }

        const post = await Post.findById(comment.post);
        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found" });
        }

        if (post.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: "Only the post owner can unpin comments" });
        }

        if (!comment.isPinned) {
            return res.status(409).json({ success: false, message: "Comment is not pinned" });
        }

        const updatedComment = await Comment.findByIdAndUpdate(
            req.params.id,
            { $set: { isPinned: false } },
            { new: true, runValidators: true }
        ).populate("author", "name profileImage");

        return res.status(200).json({
            success: true,
            message: "Comment unpinned successfully",
            data: { comment: updatedComment }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getPinnedCommentsByPost = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.postId)) {
            return res.status(400).json({ success: false, message: "Invalid post ID" });
        }

        const comments = await Comment.find({ post: req.params.postId, isPinned: true })
            .populate("author", "name profileImage")
            .sort({ createdAt: -1 });

        return res.status(200).json({ success: true, data: { comments } });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
import mongoose from "mongoose";
import Post from "./post.model.js";

// Create a post
export const createPost = async (req, res) => {
    try {
        const { content, images, codeBlocks, tags } = req.body;
        const post = await Post.create({ author: req.user._id, content, images, codeBlocks, tags });

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
        const posts = await Post.find()
            .populate("author", "name profileImage")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: { posts }
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
        const { content, images, codeBlocks, tags } = req.body;
        const post = await Post.findOneAndUpdate(
            { _id: req.params.id, author: req.user._id },
            { content, images, codeBlocks, tags },
            {
                new: true,
                runValidators: true
            }
        );

        if (!post) {
            return res.status(404).json({
                success: false,
                message: "Post not found"
            });
        }

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
        const post = await Post.findOneAndDelete({ _id: req.params.id, author: req.user._id });

        if (!post) {
            return res.status(404).json({
                success: false,
                message: "Post not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Post deleted successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
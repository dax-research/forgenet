import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "./user.model.js";
import Post from "../posts/post.model.js";

const publicUser = (user) => {
    const value = user.toObject ? user.toObject() : { ...user };
    delete value.password;
    return value;
};

export const createUser = async (req, res) => {
    try {
        const { name, email, password, profileImage, bio, skills, githubUrl, portfolioUrl, isJobSeeking } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: "Name, email, and password are required" });
        }

        const user = await User.create({
            name,
            email: email.trim().toLowerCase(),
            password: await bcrypt.hash(password, 12),
            profileImage,
            bio,
            skills,
            githubUrl,
            portfolioUrl,
            isJobSeeking
        });

        return res.status(201).json({
            success: true,
            message: "User created successfully",
            data: { user: publicUser(user) }
        });
    } catch (error) {
        const status = error.code === 11000 ? 409 : error.name === "ValidationError" ? 400 : 500;
        return res.status(status).json({
            success: false,
            message: status === 500 ? "Internal server error" : error.message
        });
    }
};

export const getUsers = async (_req, res) => {
    const users = await User.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: { users } });
};

export const getUser = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({ success: true, data: { user } });
};

export const updateUser = async (req, res) => {
    const { name, profileImage, bio, skills, githubUrl, portfolioUrl, isJobSeeking } = req.body;
    const user = await User.findByIdAndUpdate(
        req.user._id,
        { name, profileImage, bio, skills, githubUrl, portfolioUrl, isJobSeeking },
        { new: true, runValidators: true }
    );

    return res.status(200).json({ success: true, message: "User updated successfully", data: { user } });
};

export const deleteUser = async (req, res) => {
    await User.findByIdAndDelete(req.user._id);
    return res.status(200).json({ success: true, message: "User deleted successfully" });
};

export const searchUsers = async (req, res) => {
    const query = req.query.q?.trim();
    if (!query) return res.status(400).json({ success: false, message: "Search query is required" });
    const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const users = await User.find({ $or: [{ name: pattern }, { skills: pattern }] }).sort({ name: 1 });
    return res.status(200).json({ success: true, data: { users } });
};

const getRelationship = async (req, res, field) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid user ID" });
    const user = await User.findById(req.params.id).populate(field, "name profileImage skills");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    return res.status(200).json({ success: true, data: { users: user[field] } });
};

export const getFollowers = (req, res) => getRelationship(req, res, "followers");
export const getFollowing = (req, res) => getRelationship(req, res, "following");

export const followUser = async (req, res) => {
    if (req.params.id === req.user._id.toString()) return res.status(400).json({ success: false, message: "You cannot follow yourself" });
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: "User not found" });
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { following: target._id } });
    await User.findByIdAndUpdate(target._id, { $addToSet: { followers: req.user._id } });
    return res.status(200).json({ success: true, message: "User followed successfully" });
};

export const unfollowUser = async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, { $pull: { following: req.params.id } });
    await User.findByIdAndUpdate(req.params.id, { $pull: { followers: req.user._id } });
    return res.status(200).json({ success: true, message: "User unfollowed successfully" });
};

export const getSavedPosts = async (req, res) => {
    if (req.params.id !== req.user._id.toString()) return res.status(403).json({ success: false, message: "You can only view your saved posts" });
    const user = await User.findById(req.user._id).populate({ path: "savedPosts", populate: { path: "author", select: "name profileImage" } });
    return res.status(200).json({ success: true, data: { posts: user.savedPosts } });
};
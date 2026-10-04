import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "./user.model.js";
import Post from "../posts/post.model.js";
import { createNotification } from "../notifications/notification.service.js";

const publicUser = (user) => {
    const value = user.toObject ? user.toObject() : { ...user };
    delete value.password;
    return value;
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const parsePagination = (req, defaultLimit = 10, maxLimit = 50) => {
    const rawLimit = req.query.limit;
    const rawSkip = req.query.skip;

    const validateNumber = (value, name, minimum, allowZero = false, def) => {
        if (value === undefined) {
            return { valid: true, value: def !== undefined ? def : minimum };
        }

        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed < minimum || (!allowZero && parsed === 0) || (name === "limit" && parsed > maxLimit)) {
            return { valid: false, message: `${name} must be a whole number greater than or equal to ${minimum}${name === "limit" ? ` and not exceed ${maxLimit}` : ""}` };
        }

        return { valid: true, value: parsed };
    };

    const limitResult = validateNumber(rawLimit, "limit", 1, false, defaultLimit);
    if (!limitResult.valid) return { error: limitResult.message };

    const skipResult = validateNumber(rawSkip, "skip", 0, true, 0);
    if (!skipResult.valid) return { error: skipResult.message };

    return { limit: limitResult.value, skip: skipResult.value, error: null };
};

export const createUser = async (req, res) => {
    try {
        const { name, email, password, profileImage, bio, skills, githubUrl, portfolioUrl, isJobSeeking } = req.body;
        const trimmedName = name?.trim();
        const trimmedEmail = email?.trim().toLowerCase();
        const trimmedPassword = password?.trim();

        if (!trimmedName || trimmedName.length < 2) {
            return res.status(400).json({ success: false, message: "Please provide a valid name with at least 2 characters" });
        }

        if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
            return res.status(400).json({ success: false, message: "Please provide a valid email address" });
        }

        if (!trimmedPassword || trimmedPassword.length < 8) {
            return res.status(400).json({ success: false, message: "Password must be at least 8 characters long" });
        }

        const user = await User.create({
            name: trimmedName,
            email: trimmedEmail,
            password: await bcrypt.hash(trimmedPassword, 12),
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

export const getUsers = async (req, res) => {
    const { limit, skip, error } = parsePagination(req);
    if (error) {
        return res.status(400).json({ success: false, message: error });
    }
    
    let query = {};
    if (req.user) {
        const user = await User.findById(req.user._id);
        if (user) {
            query = {
                _id: { $ne: user._id, $nin: user.following }
            };
        }
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);
    return res.status(200).json({ success: true, data: { users, total, limit, skip } });
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
    if (req.params.id && req.params.id !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: "You are not authorized to modify this user" });
    }

    const { name, profileImage, bio, skills, githubUrl, portfolioUrl, isJobSeeking } = req.body;
    const user = await User.findByIdAndUpdate(
        req.user._id,
        { name, profileImage, bio, skills, githubUrl, portfolioUrl, isJobSeeking },
        { new: true, runValidators: true }
    );

    return res.status(200).json({ success: true, message: "User updated successfully", data: { user } });
};

export const deleteUser = async (req, res) => {
    if (req.params.id && req.params.id !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: "You are not authorized to delete this user" });
    }

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
    const { limit, skip, error } = parsePagination(req);
    if (error) {
        return res.status(400).json({ success: false, message: error });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const ids = user[field].map((id) => id.toString());
    const total = ids.length;
    const pageIds = ids.slice(skip, skip + limit);
    const users = await User.find({ _id: { $in: pageIds } }).select("name profileImage skills").sort({ name: 1 });

    return res.status(200).json({ success: true, data: { users, total, limit, skip } });
};

export const getFollowers = (req, res) => getRelationship(req, res, "followers");
export const getFollowing = (req, res) => getRelationship(req, res, "following");

export const followUser = async (req, res) => {
    if (req.params.id === req.user._id.toString()) return res.status(400).json({ success: false, message: "You cannot follow yourself" });
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: "User not found" });

    // Only notify on a genuinely new follow edge.
    const alreadyFollowing = (req.user.following || []).some((id) => id.toString() === target._id.toString());

    await User.findByIdAndUpdate(req.user._id, { $addToSet: { following: target._id } });
    await User.findByIdAndUpdate(target._id, { $addToSet: { followers: req.user._id } });

    if (!alreadyFollowing) {
        await createNotification({
            recipientId: target._id,
            senderId: req.user._id,
            type: "follow",
            message: `${req.user.name} started following you.`,
            data: { userId: req.user._id.toString() },
            dedupeKey: `follow:${req.user._id}:${target._id}`
        });
    }

    return res.status(200).json({ success: true, message: "User followed successfully" });
};

export const unfollowUser = async (req, res) => {
    if (req.params.id === req.user._id.toString()) return res.status(400).json({ success: false, message: "You cannot unfollow yourself" });
    await User.findByIdAndUpdate(req.user._id, { $pull: { following: req.params.id } });
    await User.findByIdAndUpdate(req.params.id, { $pull: { followers: req.user._id } });
    return res.status(200).json({ success: true, message: "User unfollowed successfully" });
};

export const getSavedPosts = async (req, res) => {
    if (req.params.id !== req.user._id.toString()) return res.status(403).json({ success: false, message: "You can only view your saved posts" });
    const { limit, skip, error } = parsePagination(req);
    if (error) {
        return res.status(400).json({ success: false, message: error });
    }
    const user = await User.findById(req.user._id);
    const ids = user.savedPosts.map((id) => id.toString());
    const total = ids.length;
    const pageIds = ids.slice(skip, skip + limit);
    const posts = await Post.find({ _id: { $in: pageIds } }).populate("author", "name profileImage").sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: { posts, total, limit, skip } });
};

export const getUserActivity = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    try {
        const userId = new mongoose.Types.ObjectId(req.params.id);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const getDailyCounts = async (Model, authorField = "author") => {
            if (!Model) return [];
            return await Model.aggregate([
                {
                    $match: {
                        [authorField]: userId,
                        createdAt: { $gte: oneYearAgo }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                        },
                        count: { $sum: 1 }
                    }
                }
            ]);
        };

        const [postCounts, projectCounts, commentCounts] = await Promise.all([
            getDailyCounts(Post, "author"),
            getDailyCounts(mongoose.models.Project, "owner"),
            getDailyCounts(mongoose.models.Comment, "author")
        ]);

        const activityMap = {};
        const addToMap = (data) => {
            if (!data) return;
            for (const item of data) {
                activityMap[item._id] = (activityMap[item._id] || 0) + item.count;
            }
        };

        addToMap(postCounts);
        addToMap(projectCounts);
        addToMap(commentCounts);

        const activity = Object.entries(activityMap).map(([date, count]) => ({ date, count }));

        return res.status(200).json({ success: true, data: { activity } });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
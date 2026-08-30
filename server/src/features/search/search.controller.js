import User from "../users/user.model.js";
import Post from "../posts/post.model.js";
import Project from "../projects/project.model.js";
import Community from "../communities/community.model.js";

const buildRegex = (query) => new RegExp(query, "i");

export const searchUsers = async (req, res) => {
    try {
        const { q, limit = 10, skip = 0 } = req.query;

        if (!q || q.trim().length === 0) {
            return res.status(400).json({ success: false, message: "Search query is required" });
        }

        const regex = buildRegex(q.trim());
        const users = await User.find({
            $or: [
                { name: regex },
                { email: regex },
                { bio: regex },
                { skills: regex }
            ]
        })
            .limit(parseInt(limit))
            .skip(parseInt(skip))
            .sort({ createdAt: -1 });

        const total = await User.countDocuments({
            $or: [
                { name: regex },
                { email: regex },
                { bio: regex },
                { skills: regex }
            ]
        });

        return res.status(200).json({
            success: true,
            data: { users, total, limit: parseInt(limit), skip: parseInt(skip) }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const searchPosts = async (req, res) => {
    try {
        const { q, limit = 10, skip = 0 } = req.query;

        if (!q || q.trim().length === 0) {
            return res.status(400).json({ success: false, message: "Search query is required" });
        }

        const regex = buildRegex(q.trim());
        const posts = await Post.find({
            $or: [
                { content: regex },
                { tags: regex }
            ]
        })
            .populate("author", "name profileImage")
            .limit(parseInt(limit))
            .skip(parseInt(skip))
            .sort({ createdAt: -1 });

        const total = await Post.countDocuments({
            $or: [
                { content: regex },
                { tags: regex }
            ]
        });

        return res.status(200).json({
            success: true,
            data: { posts, total, limit: parseInt(limit), skip: parseInt(skip) }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const searchProjects = async (req, res) => {
    try {
        const { q, limit = 10, skip = 0 } = req.query;

        if (!q || q.trim().length === 0) {
            return res.status(400).json({ success: false, message: "Search query is required" });
        }

        const regex = buildRegex(q.trim());
        const projects = await Project.find({
            $or: [
                { title: regex },
                { description: regex },
                { technologies: regex }
            ]
        })
            .populate("owner", "name profileImage")
            .limit(parseInt(limit))
            .skip(parseInt(skip))
            .sort({ createdAt: -1 });

        const total = await Project.countDocuments({
            $or: [
                { title: regex },
                { description: regex },
                { technologies: regex }
            ]
        });

        return res.status(200).json({
            success: true,
            data: { projects, total, limit: parseInt(limit), skip: parseInt(skip) }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const searchCommunities = async (req, res) => {
    try {
        const { q, limit = 10, skip = 0 } = req.query;

        if (!q || q.trim().length === 0) {
            return res.status(400).json({ success: false, message: "Search query is required" });
        }

        const regex = buildRegex(q.trim());
        const communities = await Community.find({
            $or: [
                { name: regex },
                { description: regex }
            ]
        })
            .populate("owner", "name profileImage")
            .limit(parseInt(limit))
            .skip(parseInt(skip))
            .sort({ createdAt: -1 });

        const total = await Community.countDocuments({
            $or: [
                { name: regex },
                { description: regex }
            ]
        });

        return res.status(200).json({
            success: true,
            data: { communities, total, limit: parseInt(limit), skip: parseInt(skip) }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

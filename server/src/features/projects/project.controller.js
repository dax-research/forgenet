import mongoose from "mongoose";
import Project from "./project.model.js";

const parsePagination = (req, defaultLimit = 10, maxLimit = 50) => {
    const rawLimit = Number.parseInt(req.query.limit ?? String(defaultLimit), 10);
    const rawSkip = Number.parseInt(req.query.skip ?? "0", 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : defaultLimit;
    const skip = Number.isFinite(rawSkip) && rawSkip >= 0 ? rawSkip : 0;
    return { limit, skip };
};

// Create project
export const createProject = async (req, res) => {
    try {
        const { title, description, images, technologies, githubUrl, liveUrl, status } = req.body;
        const project = await Project.create({ owner: req.user._id, title, description, images, technologies, githubUrl, liveUrl, status });

        return res.status(201).json({
            success: true,
            message: "Project created successfully",
            data: { project }
        });
    } catch (error) {
        return res.status(error.name === "ValidationError" ? 400 : 500).json({
            success: false,
            message: error.name === "ValidationError" ? error.message : "Internal server error"
        });
    }
};


// Get all projects
export const getProjects = async (req, res) => {
    try {
        const { limit, skip } = parsePagination(req);
        const total = await Project.countDocuments();
        const projects = await Project.find()
            .populate("owner", "name profileImage")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        return res.status(200).json({
            success: true,
            data: { projects, total, limit, skip }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// Get single project
export const getProject = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid project ID" });
        }

        const project = await Project.findById(req.params.id)
            .populate("owner", "name profileImage");

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: { project }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// Update project
export const updateProject = async (req, res) => {
    try {
        const { title, description, images, technologies, githubUrl, liveUrl, status } = req.body;
        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found"
            });
        }

        if (project.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to modify this project"
            });
        }

        Object.assign(project, { title, description, images, technologies, githubUrl, liveUrl, status });
        await project.save();

        return res.status(200).json({
            success: true,
            message: "Project updated successfully",
            data: { project }
        });
    } catch (error) {
        return res.status(error.name === "ValidationError" ? 400 : 500).json({
            success: false,
            message: error.name === "ValidationError" ? error.message : "Internal server error"
        });
    }
};


// Delete project
export const deleteProject = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found"
            });
        }

        if (project.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to modify this project"
            });
        }

        await project.deleteOne();

        res.status(200).json({
            success: true,
            message: "Project deleted successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const searchProjects = async (req, res) => {
    const query = req.query.q?.trim();
    if (!query) return res.status(400).json({ success: false, message: "Search query is required" });
    const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const projects = await Project.find({ $or: [{ title: pattern }, { description: pattern }, { technologies: pattern }] })
        .populate("owner", "name profileImage").sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: { projects } });
};
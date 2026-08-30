import mongoose from "mongoose";
import Project from "./project.model.js";

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
        const projects = await Project.find()
            .populate("owner", "name profileImage")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: { projects }
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
        const project = await Project.findOneAndUpdate(
            { _id: req.params.id, owner: req.user._id },
            { title, description, images, technologies, githubUrl, liveUrl, status },
            {
                new: true,
                runValidators: true
            }
        );

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found"
            });
        }

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
        const project = await Project.findOneAndDelete({ _id: req.params.id, owner: req.user._id });

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found"
            });
        }

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
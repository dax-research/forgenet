import Project from "./project.model.js";

// Create project
export const createProject = async (req, res) => {
    try {
        const project = await Project.create(req.body);

        res.status(201).json({
            success: true,
            message: "Project created successfully",
            project
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// Get all projects
export const getProjects = async (req, res) => {
    try {
        const projects = await Project.find()
            .populate("owner", "name profileImage")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            projects
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
        const project = await Project.findById(req.params.id)
            .populate("owner", "name profileImage");

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found"
            });
        }

        res.status(200).json({
            success: true,
            project
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// Update project
export const updateProject = async (req, res) => {
    try {
        const project = await Project.findByIdAndUpdate(
            req.params.id,
            req.body,
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

        res.status(200).json({
            success: true,
            message: "Project updated successfully",
            project
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// Delete project
export const deleteProject = async (req, res) => {
    try {
        const project = await Project.findByIdAndDelete(
            req.params.id
        );

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
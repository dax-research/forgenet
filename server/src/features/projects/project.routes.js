import { Router } from "express";

import {
    createProject,
    getProjects,
    getProject,
    updateProject,
    deleteProject,
    searchProjects
} from "./project.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const projectRouter = Router();

projectRouter.post("/", authenticate, createProject);

projectRouter.get("/", getProjects);
projectRouter.get("/search", searchProjects);

projectRouter.get("/:id", getProject);

projectRouter.patch("/:id", authenticate, updateProject);
projectRouter.put("/:id", authenticate, updateProject);

projectRouter.delete("/:id", authenticate, deleteProject);

export default projectRouter;
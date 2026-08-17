import { Router } from "express";

import {
    createProject,
    getProjects,
    getProject,
    updateProject,
    deleteProject
} from "./project.controller.js";

const projectRouter = Router();

projectRouter.post("/", createProject);

projectRouter.get("/", getProjects);

projectRouter.get("/:id", getProject);

projectRouter.put("/:id", updateProject);

projectRouter.delete("/:id", deleteProject);

export default projectRouter;
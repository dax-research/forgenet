import { Router } from "express";
import {
    searchUsers,
    searchPosts,
    searchProjects,
    searchCommunities
} from "./search.controller.js";

const searchRouter = Router();

searchRouter.get("/users", searchUsers);
searchRouter.get("/posts", searchPosts);
searchRouter.get("/projects", searchProjects);
searchRouter.get("/communities", searchCommunities);

export default searchRouter;

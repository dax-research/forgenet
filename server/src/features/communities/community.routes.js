import { Router } from "express";

import {
    createCommunity,
    getCommunities,
    getCommunity,
    updateCommunity,
    deleteCommunity,
    joinCommunity,
    leaveCommunity
} from "./community.controller.js";

const communityRouter = Router();

communityRouter.post("/", createCommunity);

communityRouter.get("/", getCommunities);

communityRouter.get("/:id", getCommunity);

communityRouter.put("/:id", updateCommunity);

communityRouter.delete("/:id", deleteCommunity);

communityRouter.post("/:id/join", joinCommunity);

communityRouter.post("/:id/leave", leaveCommunity);

export default communityRouter;
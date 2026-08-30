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
import { authenticate } from "../../middleware/auth.middleware.js";

const communityRouter = Router();

communityRouter.post("/", authenticate, createCommunity);

communityRouter.get("/", getCommunities);

communityRouter.get("/:id", getCommunity);

communityRouter.patch("/:id", authenticate, updateCommunity);

communityRouter.delete("/:id", authenticate, deleteCommunity);

communityRouter.post("/:id/join", authenticate, joinCommunity);

communityRouter.post("/:id/leave", authenticate, leaveCommunity);

export default communityRouter;
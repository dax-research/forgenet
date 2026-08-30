import { Router } from "express";

import {
    createCommunity,
    getCommunities,
    getCommunity,
    updateCommunity,
    deleteCommunity,
    joinCommunity,
    leaveCommunity,
    searchCommunities,
    getMembers
} from "./community.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { createCommunityPost, getCommunityPosts } from "./community-post.controller.js";

const communityRouter = Router();

communityRouter.post("/", authenticate, createCommunity);

communityRouter.get("/", getCommunities);
communityRouter.get("/search", searchCommunities);
communityRouter.get("/:id/members", getMembers);
communityRouter.get("/:id/posts", getCommunityPosts);
communityRouter.post("/:id/posts", authenticate, createCommunityPost);

communityRouter.get("/:id", getCommunity);

communityRouter.patch("/:id", authenticate, updateCommunity);
communityRouter.put("/:id", authenticate, updateCommunity);

communityRouter.delete("/:id", authenticate, deleteCommunity);

communityRouter.post("/:id/join", authenticate, joinCommunity);
communityRouter.post("/:id/members", authenticate, joinCommunity);

communityRouter.post("/:id/leave", authenticate, leaveCommunity);
communityRouter.delete("/:id/members", authenticate, leaveCommunity);

export default communityRouter;
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
    getMembers,
    getJoinRequests,
    respondToJoinRequest,
    cancelJoinRequest
} from "./community.controller.js";
import { authenticate, optionalAuthenticate } from "../../middleware/auth.middleware.js";
import { createCommunityPost, getCommunityPosts } from "./community-post.controller.js";

const communityRouter = Router();

communityRouter.post("/", authenticate, createCommunity);

communityRouter.get("/", optionalAuthenticate, getCommunities);
communityRouter.get("/search", searchCommunities);
communityRouter.get("/:id/members", getMembers);
communityRouter.get("/:id/join-requests", authenticate, getJoinRequests);
communityRouter.patch("/:id/join-requests/:requestId", authenticate, respondToJoinRequest);
communityRouter.delete("/:id/join-requests", authenticate, cancelJoinRequest);
communityRouter.delete("/:id/join-requests/:requestId", authenticate, cancelJoinRequest);
communityRouter.get("/:id/posts", getCommunityPosts);
communityRouter.post("/:id/posts", authenticate, createCommunityPost);

communityRouter.get("/:id", optionalAuthenticate, getCommunity);

communityRouter.patch("/:id", authenticate, updateCommunity);
communityRouter.put("/:id", authenticate, updateCommunity);

communityRouter.delete("/:id", authenticate, deleteCommunity);

communityRouter.post("/:id/join", authenticate, joinCommunity);
communityRouter.post("/:id/members", authenticate, joinCommunity);

communityRouter.post("/:id/leave", authenticate, leaveCommunity);
communityRouter.delete("/:id/members", authenticate, leaveCommunity);

export default communityRouter;
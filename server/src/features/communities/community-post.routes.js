import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { deleteCommunityPost, updateCommunityPost } from "./community-post.controller.js";

const communityPostRouter = Router();
communityPostRouter.put("/:id", authenticate, updateCommunityPost);
communityPostRouter.delete("/:id", authenticate, deleteCommunityPost);
export default communityPostRouter;
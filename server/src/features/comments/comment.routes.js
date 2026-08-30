import { Router } from "express";

import {
    createComment,
    getCommentsByPost,
    updateComment,
    deleteComment,
    pinComment,
    unpinComment,
    getPinnedCommentsByPost
} from "./comment.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const commentRouter = Router();

commentRouter.post("/", authenticate, createComment);
commentRouter.post("/post/:postId", authenticate, createComment);

commentRouter.get("/post/:postId", getCommentsByPost);
commentRouter.get("/post/:postId/pinned", getPinnedCommentsByPost);

commentRouter.patch("/:id", authenticate, updateComment);
commentRouter.put("/:id", authenticate, updateComment);
commentRouter.post("/:id/pin", authenticate, pinComment);
commentRouter.delete("/:id/pin", authenticate, unpinComment);

commentRouter.delete("/:id", authenticate, deleteComment);

export default commentRouter;
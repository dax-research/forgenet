import { Router } from "express";

import {
    createComment,
    getCommentsByPost,
    updateComment,
    deleteComment
} from "./comment.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const commentRouter = Router();

commentRouter.post("/", authenticate, createComment);
commentRouter.post("/post/:postId", authenticate, createComment);

commentRouter.get("/post/:postId", getCommentsByPost);

commentRouter.patch("/:id", authenticate, updateComment);
commentRouter.put("/:id", authenticate, updateComment);

commentRouter.delete("/:id", authenticate, deleteComment);

export default commentRouter;
import { Router } from "express";

import {
    createComment,
    getCommentsByPost,
    updateComment,
    deleteComment
} from "./comment.controller.js";

const commentRouter = Router();

commentRouter.post("/", createComment);

commentRouter.get("/post/:postId", getCommentsByPost);

commentRouter.put("/:id", updateComment);

commentRouter.delete("/:id", deleteComment);

export default commentRouter;
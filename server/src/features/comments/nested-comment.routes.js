import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { createComment, getCommentsByPost } from "./comment.controller.js";

const nestedCommentRouter = Router({ mergeParams: true });
nestedCommentRouter.get("/", getCommentsByPost);
nestedCommentRouter.post("/", authenticate, createComment);
export default nestedCommentRouter;
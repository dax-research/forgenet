import { Router } from "express";
import {
    createPost,
    getPosts,
    getPost,
    updatePost,
    deletePost
} from "./post.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

var postRouter = Router();

postRouter.post("/", authenticate, createPost);
postRouter.get("/", getPosts);
postRouter.get("/:id", getPost);
postRouter.patch("/:id", authenticate, updatePost);
postRouter.delete("/:id", authenticate, deletePost);

export default postRouter;
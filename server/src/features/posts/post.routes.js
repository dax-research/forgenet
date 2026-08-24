import { Router } from "express";
import {
    createPost,
    getPosts,
    getPost,
    updatePost,
    deletePost,
    searchPosts,
    savePost,
    unsavePost
} from "./post.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

var postRouter = Router();

postRouter.post("/", authenticate, createPost);
postRouter.get("/", getPosts);
postRouter.get("/search", searchPosts);
postRouter.post("/:id/save", authenticate, savePost);
postRouter.delete("/:id/save", authenticate, unsavePost);
postRouter.get("/:id", getPost);
postRouter.patch("/:id", authenticate, updatePost);
postRouter.put("/:id", authenticate, updatePost);
postRouter.delete("/:id", authenticate, deletePost);

export default postRouter;
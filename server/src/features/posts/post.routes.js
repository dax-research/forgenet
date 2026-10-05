import { Router } from "express";
import {
    createPost,
    getPosts,
    getPost,
    updatePost,
    deletePost,
    searchPosts,
    savePost,
    unsavePost,
    likePost,
    unlikePost,
    getTrendingTopics,
} from "./post.controller.js";
import { authenticate, optionalAuthenticate } from "../../middleware/auth.middleware.js";
import { uploadPostImages } from "../../middleware/upload.middleware.js";

var postRouter = Router();

postRouter.post("/", authenticate, uploadPostImages, createPost);
postRouter.get("/", optionalAuthenticate, getPosts);     // optionalAuthenticate so isLiked works for logged-in users
postRouter.get("/search", searchPosts);
postRouter.get("/trending", getTrendingTopics);          // before /:id to avoid capture
postRouter.post("/:id/save", authenticate, savePost);
postRouter.delete("/:id/save", authenticate, unsavePost);
postRouter.post("/:id/like", authenticate, likePost);
postRouter.delete("/:id/like", authenticate, unlikePost);
postRouter.get("/:id", getPost);
// Editing a post can add or remove images, so the same upload middleware as
// creation is applied here.
postRouter.patch("/:id", authenticate, uploadPostImages, updatePost);
postRouter.put("/:id", authenticate, uploadPostImages, updatePost);
postRouter.delete("/:id", authenticate, deletePost);

export default postRouter;
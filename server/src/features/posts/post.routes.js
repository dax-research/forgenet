import { Router } from "express";
import {
    createPost,
    getPosts,
    getPost,
    updatePost,
    deletePost
} from "./post.controller.js";

var postRouter = Router();

postRouter.post("/", createPost);
postRouter.get("/", getPosts);
postRouter.get("/:id", getPost);
postRouter.put("/:id", updatePost);
postRouter.delete("/:id", deletePost);

export default postRouter;
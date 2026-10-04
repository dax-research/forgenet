import { Router } from "express";
import { authenticate, optionalAuthenticate } from "../../middleware/auth.middleware.js";
import { uploadAvatarImage } from "../../middleware/upload.middleware.js";
import { createUser, deleteUser, followUser, getFollowers, getFollowing, getSavedPosts, getUser, getUsers, removeAvatar, searchUsers, unfollowUser, updateUser, getUserActivity } from "./user.controller.js";

const userRouter = Router();

userRouter.post("/", createUser);
userRouter.get("/", optionalAuthenticate, getUsers);
userRouter.get("/search", searchUsers);
userRouter.get("/:id/saved-posts", authenticate, getSavedPosts);
userRouter.get("/:id/activity", getUserActivity);
userRouter.get("/:id/followers", getFollowers);
userRouter.get("/:id/following", getFollowing);
userRouter.post("/:id/follow", authenticate, followUser);
userRouter.delete("/:id/follow", authenticate, unfollowUser);
userRouter.get("/:id", getUser);
userRouter.delete("/me/avatar", authenticate, removeAvatar);
// Multipart so a photo can be uploaded alongside other profile fields.
userRouter.patch("/me", authenticate, uploadAvatarImage, updateUser);
userRouter.put("/:id", authenticate, uploadAvatarImage, updateUser);
userRouter.delete("/me", authenticate, deleteUser);
userRouter.delete("/:id", authenticate, deleteUser);

export default userRouter;
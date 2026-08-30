import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { createUser, deleteUser, getUser, getUsers, updateUser } from "./user.controller.js";

const userRouter = Router();

userRouter.post("/", createUser);
userRouter.get("/", getUsers);
userRouter.get("/:id", getUser);
userRouter.patch("/me", authenticate, updateUser);
userRouter.delete("/me", authenticate, deleteUser);

export default userRouter;
import { Router } from "express";

import { getMe, login, logout, register, updatePassword } from "./auth.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const authRouter = Router();

authRouter.post("/login", login);
authRouter.post("/register", register);
authRouter.get("/me", authenticate, getMe);
authRouter.put("/password", authenticate, updatePassword);
authRouter.delete("/logout", authenticate, logout);

export default authRouter;

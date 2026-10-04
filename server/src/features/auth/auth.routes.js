import { Router } from "express";

import { getMe, login, logout, register, updatePassword, forgotPassword, resetPassword } from "./auth.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const authRouter = Router();

authRouter.post("/login", login);
authRouter.post("/register", register);
authRouter.post("/forgot-password", forgotPassword);
authRouter.post("/reset-password", resetPassword);
authRouter.get("/me", authenticate, getMe);
authRouter.put("/password", authenticate, updatePassword);
authRouter.delete("/logout", authenticate, logout);

export default authRouter;

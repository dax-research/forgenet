import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { deleteMessage, updateMessage } from "./chat.controller.js";

const messageRouter = Router();
messageRouter.use(authenticate);
messageRouter.put("/:id", updateMessage);
messageRouter.delete("/:id", deleteMessage);
export default messageRouter;
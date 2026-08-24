import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { createConversation, createMessage, deleteConversation, deleteMessage, getConversation, getConversations, getMessages, updateConversation, updateMessage } from "./chat.controller.js";

const chatRouter = Router();
chatRouter.use(authenticate);
chatRouter.get("/", getConversations);
chatRouter.post("/", createConversation);
chatRouter.get("/:id", getConversation);
chatRouter.put("/:id", updateConversation);
chatRouter.delete("/:id", deleteConversation);
chatRouter.get("/:conversationId/messages", getMessages);
chatRouter.post("/:conversationId/messages", createMessage);
chatRouter.put("/messages/:id", updateMessage);
chatRouter.delete("/messages/:id", deleteMessage);
export default chatRouter;
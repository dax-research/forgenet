import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { createMessage, getMessages, getMessage, updateMessage, deleteMessage } from "./message.controller.js";

const messageRouter = Router();
messageRouter.use(authenticate);

// Create a new message
messageRouter.post("/", createMessage);

// Get all messages for a conversation (chronological)
messageRouter.get("/conversation/:conversationId", getMessages);

// Get a single message by ID
messageRouter.get("/:id", getMessage);

// Update a message (sender only)
messageRouter.put("/:id", updateMessage);

// Delete a message (sender only)
messageRouter.delete("/:id", deleteMessage);

export default messageRouter;

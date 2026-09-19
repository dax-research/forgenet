// socket.server.js
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import User from "../features/users/user.model.js";
import Conversation from "../features/chat/conversation.model.js";
import Message from "../features/chat/message.model.js";

/**
 * Attaches a Socket.IO server to an existing HTTP server.
 * The HTTP server is created in server.js and passed here.
 */
export const attachSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: env.clientUrl,
      credentials: true,
    },
  });
  // In‑memory map of userId → Set of active socket IDs.
  const userSockets = new Map(); // string => Set<string>
  // JWT authentication for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error("Authentication error: token missing"));
      }
      const payload = jwt.verify(token, env.jwtSecret);
      const user = await User.findById(payload.sub).select("-password");
      if (!user) {
        return next(new Error("Authentication error: user not found"));
      }
      // Attach safe user info (no passwords, secrets)
      socket.user = user;
      return next();
    } catch (err) {
      return next(new Error("Authentication error: invalid token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}, user: ${socket.user._id}`);

    // ---------- Join Conversation ----------
    socket.on("join_conversation", async (data, ack) => {
      try {
        const { conversationId } = data || {};
        if (!conversationId) {
          const err = { success: false, message: "conversationId is required" };
          if (ack) return ack(err);
          return socket.emit("error", err);
        }
        if (!Conversation.isValidObjectId(conversationId)) {
          const err = { success: false, message: "Invalid conversationId" };
          if (ack) return ack(err);
          return socket.emit("error", err);
        }
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          const err = { success: false, message: "Conversation not found" };
          if (ack) return ack(err);
          return socket.emit("error", err);
        }
        const isMember = conversation.participants.some(
          (id) => id.toString() === socket.user._id.toString()
        );
        if (!isMember) {
          const err = { success: false, message: "Forbidden: not a participant" };
          if (ack) return ack(err);
          return socket.emit("error", err);
        }
        socket.join(conversationId);
        if (ack) return ack({ success: true, message: "joined" });
      } catch (e) {
        const err = { success: false, message: "Server error while joining" };
        if (ack) return ack(err);
        socket.emit("error", err);
      }
    });

    // ---------- Leave Conversation ----------
    socket.on("leave_conversation", async (data, ack) => {
      try {
        const { conversationId } = data || {};
        if (!conversationId) {
          const err = { success: false, message: "conversationId is required" };
          if (ack) return ack(err);
          return socket.emit("error", err);
        }
        if (!Conversation.isValidObjectId(conversationId)) {
          const err = { success: false, message: "Invalid conversationId" };
          if (ack) return ack(err);
          return socket.emit("error", err);
        }
        socket.leave(conversationId);
        if (ack) return ack({ success: true, message: "left" });
      } catch (e) {
        const err = { success: false, message: "Server error while leaving" };
        if (ack) return ack(err);
        socket.emit("error", err);
      }
    });

    // ---------- Send Message ----------
    socket.on("send_message", async (data, ack) => {
      try {
        const { conversationId, content } = data || {};
        if (!conversationId) {
          const err = { success: false, message: "conversationId is required" };
          if (ack) return ack(err);
          return socket.emit("error", err);
        }
        if (!content || !content.trim()) {
          const err = { success: false, message: "Message content is required" };
          if (ack) return ack(err);
          return socket.emit("error", err);
        }
        if (!Conversation.isValidObjectId(conversationId)) {
          const err = { success: false, message: "Invalid conversationId" };
          if (ack) return ack(err);
          return socket.emit("error", err);
        }
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          const err = { success: false, message: "Conversation not found" };
          if (ack) return ack(err);
          return socket.emit("error", err);
        }
        const isMember = conversation.participants.some(
          (id) => id.toString() === socket.user._id.toString()
        );
        if (!isMember) {
          const err = { success: false, message: "Forbidden: not a participant" };
          if (ack) return ack(err);
          return socket.emit("error", err);
        }
        // Persist message using existing Message model
        const message = await Message.create({
          conversation: conversation._id,
          sender: socket.user._id,
          content: content.trim(),
        });
        // Keep conversation ordering consistent with REST API
        await Conversation.findByIdAndUpdate(conversation._id, { updatedAt: new Date() });
        const populated = await message.populate("sender", "name profileImage");
        // Emit to all participants in the room after DB success
        io.to(conversationId).emit("new_message", populated);
        if (ack) return ack({ success: true, data: { message: populated } });
      } catch (e) {
        const err = { success: false, message: "Server error while sending message" };
        if (ack) return ack(err);
        socket.emit("error", err);
      }
    });

    // ---------- Disconnect ----------
    socket.on("disconnect", (reason) => {
      console.log(`Socket ${socket.id} disconnected: ${reason}`);
    });
  });

  return io;
};

// socket.server.js
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import User from "../features/users/user.model.js";
import Conversation from "../features/chat/conversation.model.js";
import Message from "../features/messages/message.model.js";

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

  // Helper: check if user is a participant of a conversation
  const isParticipant = (conversation, userId) =>
    conversation.participants.some((id) => id.toString() === userId.toString());

  // Helper: validate conversation access and return conversation or null
  const validateConversationAccess = async (conversationId, userId) => {
    if (!Conversation.isValidObjectId(conversationId)) {
      return { error: "Invalid conversationId", conversation: null };
    }
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return { error: "Conversation not found", conversation: null };
    }
    if (!isParticipant(conversation, userId)) {
      return { error: "Forbidden: not a participant", conversation: null };
    }
    return { error: null, conversation };
  };

  // Helper: emit error via ack or socket.emit
  const emitError = (socket, ack, message) => {
    const err = { success: false, message };
    if (ack) return ack(err);
    socket.emit("error", err);
  };

  // Helper: add socket to user's socket set, return true if this is the first socket
  const addUserSocket = (userId, socketId) => {
    const userIdStr = userId.toString();
    let sockets = userSockets.get(userIdStr);
    if (!sockets) {
      sockets = new Set();
      userSockets.set(userIdStr, sockets);
    }
    const isFirstSocket = sockets.size === 0;
    sockets.add(socketId);
    return isFirstSocket;
  };

  // Helper: remove socket from user's socket set, return true if this was the last socket
  const removeUserSocket = (userId, socketId) => {
    const userIdStr = userId.toString();
    const sockets = userSockets.get(userIdStr);
    if (!sockets) return false;
    sockets.delete(socketId);
    if (sockets.size === 0) {
      userSockets.delete(userIdStr);
      return true;
    }
    return false;
  };

  // Helper: check if user is online
  const isUserOnline = (userId) => {
    const sockets = userSockets.get(userId.toString());
    return sockets && sockets.size > 0;
  };

  // Helper: emit user presence change to relevant users
  // For now, broadcast to all connected sockets (can be optimized later to only relevant users)
  const emitUserPresence = (userId, status) => {
    io.emit(status === "online" ? "user_online" : "user_offline", {
      userId: userId.toString(),
      status,
    });
  };

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

    // Track user presence
    const isFirstSocket = addUserSocket(socket.user._id, socket.id);
    if (isFirstSocket) {
      emitUserPresence(socket.user._id, "online");
    }

    // ---------- Get Presence ----------
    socket.on("get_presence", async (data, ack) => {
      try {
        const { userId } = data || {};
        if (!userId) {
          return emitError(socket, ack, "userId is required");
        }
        if (!Conversation.isValidObjectId(userId)) {
          return emitError(socket, ack, "Invalid userId");
        }
        const online = isUserOnline(userId);
        if (ack) return ack({ success: true, data: { userId, online } });
      } catch (e) {
        emitError(socket, ack, "Server error while checking presence");
      }
    });

    // ---------- Join Conversation ----------
    socket.on("join_conversation", async (data, ack) => {
      try {
        const { conversationId } = data || {};
        if (!conversationId) {
          return emitError(socket, ack, "conversationId is required");
        }
        const { error, conversation } = await validateConversationAccess(
          conversationId,
          socket.user._id
        );
        if (error) {
          return emitError(socket, ack, error);
        }
        socket.join(conversationId);
        if (ack) return ack({ success: true, message: "joined" });
      } catch (e) {
        emitError(socket, ack, "Server error while joining");
      }
    });

    // ---------- Leave Conversation ----------
    socket.on("leave_conversation", async (data, ack) => {
      try {
        const { conversationId } = data || {};
        if (!conversationId) {
          return emitError(socket, ack, "conversationId is required");
        }
        if (!Conversation.isValidObjectId(conversationId)) {
          return emitError(socket, ack, "Invalid conversationId");
        }
        socket.leave(conversationId);
        if (ack) return ack({ success: true, message: "left" });
      } catch (e) {
        emitError(socket, ack, "Server error while leaving");
      }
    });

    // ---------- Send Message ----------
    socket.on("send_message", async (data, ack) => {
      try {
        const { conversationId, content } = data || {};
        if (!conversationId) {
          return emitError(socket, ack, "conversationId is required");
        }
        if (!content || !content.trim()) {
          return emitError(socket, ack, "Message content is required");
        }
        const { error, conversation } = await validateConversationAccess(
          conversationId,
          socket.user._id
        );
        if (error) {
          return emitError(socket, ack, error);
        }
        // Persist message using existing Message model
        const message = await Message.create({
          conversation: conversation._id,
          sender: socket.user._id,
          content: content.trim(),
        });
        // Keep conversation ordering consistent with REST API
        await Conversation.findByIdAndUpdate(conversation._id, {
          updatedAt: new Date(),
        });
        const populated = await message.populate("sender", "name profileImage");
        // Emit to all participants in the room after DB success
        io.to(conversationId).emit("new_message", populated);
        if (ack) return ack({ success: true, data: { message: populated } });
      } catch (e) {
        emitError(socket, ack, "Server error while sending message");
      }
    });

    // ---------- Typing Start ----------
    socket.on("typing_start", async (data, ack) => {
      try {
        const { conversationId } = data || {};
        if (!conversationId) {
          return emitError(socket, ack, "conversationId is required");
        }
        const { error, conversation } = await validateConversationAccess(
          conversationId,
          socket.user._id
        );
        if (error) {
          return emitError(socket, ack, error);
        }
        // Broadcast to other participants in the conversation room (exclude sender)
        socket
          .to(conversationId)
          .emit("user_typing", {
            userId: socket.user._id.toString(),
            conversationId,
          });
        if (ack) return ack({ success: true });
      } catch (e) {
        emitError(socket, ack, "Server error while processing typing start");
      }
    });

    // ---------- Typing Stop ----------
    socket.on("typing_stop", async (data, ack) => {
      try {
        const { conversationId } = data || {};
        if (!conversationId) {
          return emitError(socket, ack, "conversationId is required");
        }
        const { error, conversation } = await validateConversationAccess(
          conversationId,
          socket.user._id
        );
        if (error) {
          return emitError(socket, ack, error);
        }
        // Broadcast to other participants in the conversation room (exclude sender)
        socket
          .to(conversationId)
          .emit("user_stopped_typing", {
            userId: socket.user._id.toString(),
            conversationId,
          });
        if (ack) return ack({ success: true });
      } catch (e) {
        emitError(socket, ack, "Server error while processing typing stop");
      }
    });

    // ---------- Disconnect ----------
    socket.on("disconnect", (reason) => {
      console.log(`Socket ${socket.id} disconnected: ${reason}`);
      const isLastSocket = removeUserSocket(socket.user._id, socket.id);
      if (isLastSocket) {
        emitUserPresence(socket.user._id, "offline");
      }
    });
  });

  return io;
};
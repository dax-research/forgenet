// socket.server.js
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import User from "../features/users/user.model.js";
import Conversation from "../features/chat/conversation.model.js";
import Message from "../features/messages/message.model.js";
import { setIO } from "../services/realtime.service.js";
import { notifyMessageSent } from "../features/chat/chat.controller.js";

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

  // Share the instance so REST handlers can emit to a user's sockets.
  setIO(io);

  // In‑memory map of userId → Set of active socket IDs.
  const userSockets = new Map(); // string => Set<string>

  // Helper: check if user is a participant of a conversation
  const isParticipant = (conversation, userId) =>
    conversation.participants.some((id) => id.toString() === userId.toString());

  const toIdString = (value) => {
    if (value == null) return "";
    if (typeof value === "object" && value._id) return value._id.toString();
    return value.toString();
  };

  const serializeMessage = (message) => {
    const obj = typeof message.toJSON === "function" ? message.toJSON() : { ...message };
    const sender = obj.sender && typeof obj.sender === "object"
      ? {
          _id: toIdString(obj.sender._id || obj.sender),
          name: obj.sender.name,
          profileImage: obj.sender.profileImage,
        }
      : toIdString(obj.sender);
    return {
      ...obj,
      _id: toIdString(obj._id),
      conversation: toIdString(obj.conversation),
      sender,
    };
  };

  // Helper: validate conversation access and return conversation or null
  const validateConversationAccess = async (conversationId, userId) => {
    if (!mongoose.isValidObjectId(conversationId)) {
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

  const emitToUserSockets = (userId, event, payload) => {
    const sockets = userSockets.get(userId.toString());
    if (!sockets) return;
    for (const socketId of sockets) {
      io.to(socketId).emit(event, payload);
    }
  };

  const emitToConversationParticipants = (
    conversation,
    event,
    payload,
    excludeUserId
  ) => {
    const roomId = conversation._id.toString();
    const exclude = excludeUserId ? excludeUserId.toString() : null;
    io.to(roomId).emit(event, payload);
    for (const participantId of conversation.participants) {
      const participant = participantId.toString();
      if (exclude && participant === exclude) continue;
      emitToUserSockets(participant, event, payload);
    }
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

  // Each socket joins a per-user room so server-side REST handlers can push
  // events (new notifications, unread counts) to every tab the user has open.
  const userRoom = (userId) => `user:${userId.toString()}`;

io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}, user: ${socket.user._id}`);

    socket.join(userRoom(socket.user._id));

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
        if (!mongoose.isValidObjectId(userId)) {
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
        socket.join(conversation._id.toString());
        if (ack) return ack({ success: true, message: "joined" });
      } catch (e) {
        console.error("[socket] join_conversation failed:", e.message);
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
        if (!mongoose.isValidObjectId(conversationId)) {
          return emitError(socket, ack, "Invalid conversationId");
        }
        socket.leave(conversationId.toString());
        if (ack) return ack({ success: true, message: "left" });
      } catch (e) {
        console.error("[socket] leave_conversation failed:", e.message);
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
        // Persist message using existing Message model. Instant sends are
        // always "sent"; scheduling goes through the REST endpoint so the
        // server-side validation rules cannot be bypassed.
        const message = await Message.create({
          conversation: conversation._id,
          sender: socket.user._id,
          content: content.trim(),
          status: "sent",
          sentAt: new Date(),
        });
        // Keep conversation ordering consistent with REST API
        await Conversation.findByIdAndUpdate(conversation._id, {
          updatedAt: new Date(),
        });
        const populated = await message.populate("sender", "name profileImage");
        const payload = serializeMessage(populated);
        emitToConversationParticipants(conversation, "new_message", payload);

        // Shared with the REST path so exactly one notification per message.
        await notifyMessageSent(message, socket.user._id);
        if (ack) return ack({ success: true, data: { message: payload } });
      } catch (e) {
        console.error("[socket] send_message failed:", e.message);
        emitError(socket, ack, "Server error while sending message");
      }
    });

    // ---------- Mark Conversation Read ----------
    socket.on("mark_conversation_read", async (data, ack) => {
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
        await Message.updateMany(
          { conversation: conversation._id, sender: { $ne: socket.user._id }, readAt: null, status: { $in: ["sent", null] } },
          { $set: { readAt: new Date() } }
        );
        const conversations = await Conversation.find({ participants: socket.user._id }).select("_id");
        const unreadCount = await Message.countDocuments({
          conversation: { $in: conversations.map((c) => c._id) },
          sender: { $ne: socket.user._id },
          readAt: null,
          status: "sent",
        });
        emitToUserSockets(socket.user._id, "messages:unread_count", { unreadCount });
        if (ack) return ack({ success: true, data: { unreadCount } });
      } catch (e) {
        console.error("[socket] mark_conversation_read failed:", e.message);
        emitError(socket, ack, "Server error while marking conversation read");
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
        const typingPayload = {
          userId: socket.user._id.toString(),
          conversationId: conversation._id.toString(),
        };
        emitToConversationParticipants(
          conversation,
          "user_typing",
          typingPayload,
          socket.user._id
        );
        if (ack) return ack({ success: true });
      } catch (e) {
        console.error("[socket] typing_start failed:", e.message);
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
        const typingPayload = {
          userId: socket.user._id.toString(),
          conversationId: conversation._id.toString(),
        };
        emitToConversationParticipants(
          conversation,
          "user_stopped_typing",
          typingPayload,
          socket.user._id
        );
        if (ack) return ack({ success: true });
      } catch (e) {
        console.error("[socket] typing_stop failed:", e.message);
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
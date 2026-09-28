import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

let socket = null;

export const socketService = {
  connect(token) {
    if (socket && socket.connected) {
      return socket;
    }

    if (socket) {
      socket.disconnect();
    }

    const authToken = token || localStorage.getItem("token");
    if (!authToken) return null;

    socket = io(SOCKET_URL, {
      auth: { token: authToken },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on("connect", () => {
      // console.log("[Socket] Connected:", socket.id);
    });

    socket.on("connect_error", (err) => {
      console.warn("[Socket] Connect error:", err.message);
    });

    return socket;
  },

  getSocket() {
    if (!socket) {
      return this.connect();
    }
    return socket;
  },

  disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },

  joinConversation(conversationId, callback) {
    if (!socket) return;
    socket.emit("join_conversation", { conversationId }, (res) => {
      if (callback) callback(res);
    });
  },

  leaveConversation(conversationId, callback) {
    if (!socket) return;
    socket.emit("leave_conversation", { conversationId }, (res) => {
      if (callback) callback(res);
    });
  },

  sendMessage(conversationId, content, callback) {
    if (!socket) return;
    socket.emit("send_message", { conversationId, content }, (res) => {
      if (callback) callback(res);
    });
  },

  startTyping(conversationId) {
    if (!socket) return;
    socket.emit("typing_start", { conversationId });
  },

  stopTyping(conversationId) {
    if (!socket) return;
    socket.emit("typing_stop", { conversationId });
  },

  getPresence(userId, callback) {
    if (!socket) return;
    socket.emit("get_presence", { userId }, (res) => {
      if (callback) callback(res);
    });
  },
};

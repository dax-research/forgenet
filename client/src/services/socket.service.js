import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

let socket = null;
const joinedRooms = new Set();

const emitWhenReady = (socketInstance, event, payload, callback) => {
  const send = () => {
    if (callback) {
      socketInstance.emit(event, payload, callback);
    } else {
      socketInstance.emit(event, payload);
    }
  };

  if (socketInstance.connected) {
    send();
    return;
  }

  socketInstance.once("connect", send);
};

export const socketService = {
  connect(token) {
    const authToken = token || localStorage.getItem("token");
    if (!authToken) return null;

    if (socket) {
      const currentToken = socket.auth?.token;
      if (currentToken && currentToken !== authToken) {
        socket.auth = { token: authToken };
        socket.disconnect();
        socket.connect();
      }
      return socket;
    }

    socket = io(SOCKET_URL, {
      auth: { token: authToken },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on("connect", () => {
      for (const conversationId of joinedRooms) {
        socket.emit("join_conversation", { conversationId });
      }
    });

    socket.on("connect_error", (err) => {
      console.warn("[Socket] Connect error:", err.message);
    });

    socket.on("disconnect", (reason) => {
      if (reason === "io server disconnect") {
        socket.connect();
      }
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
    joinedRooms.clear();
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }
  },

  joinConversation(conversationId, callback) {
    if (!conversationId) return;
    const id = String(conversationId);
    joinedRooms.add(id);
    const current = this.getSocket();
    if (!current) return;
    emitWhenReady(current, "join_conversation", { conversationId: id }, callback);
  },

  leaveConversation(conversationId, callback) {
    if (!conversationId) return;
    const id = String(conversationId);
    joinedRooms.delete(id);
    if (!socket) return;
    emitWhenReady(socket, "leave_conversation", { conversationId: id }, callback);
  },

  sendMessage(conversationId, content, callback) {
    const current = this.getSocket();
    if (!current || !conversationId) return;
    emitWhenReady(
      current,
      "send_message",
      { conversationId: String(conversationId), content },
      callback
    );
  },

  markConversationRead(conversationId, callback) {
    const current = this.getSocket();
    if (!current || !conversationId) return;
    emitWhenReady(
      current,
      "mark_conversation_read",
      { conversationId: String(conversationId) },
      callback
    );
  },

  startTyping(conversationId) {
    const current = this.getSocket();
    if (!current || !conversationId) return;
    emitWhenReady(current, "typing_start", { conversationId: String(conversationId) });
  },

  stopTyping(conversationId) {
    const current = this.getSocket();
    if (!current || !conversationId) return;
    emitWhenReady(current, "typing_stop", { conversationId: String(conversationId) });
  },

  getPresence(userId, callback) {
    const current = this.getSocket();
    if (!current || !userId) return;
    emitWhenReady(current, "get_presence", { userId: String(userId) }, callback);
  },
};

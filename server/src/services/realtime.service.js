/**
 * Holds the Socket.IO server instance so REST handlers can push real-time
 * events without every controller importing the socket layer.
 */
let io = null;

export const setIO = (server) => {
  io = server;
};

export const getIO = () => io;

/**
 * Emit to a conversation's participants.
 *
 * Delivers to BOTH the conversation room and each participant's personal room,
 * which is what the existing instant-message path does. Relying on the room
 * alone would drop the message for a participant who has not joined that
 * conversation (for example a client that has not opened it yet).
 *
 * Safe to call when nobody is connected — the message is already persisted and
 * will appear in conversation history.
 */
export const emitToConversation = (conversationId, event, payload, participantIds = []) => {
  if (!io || !conversationId) return false;
  const room = conversationId.toString();
  io.to(room).emit(event, payload);
  for (const participantId of participantIds) {
    io.to(`user:${participantId.toString()}`).emit(event, payload);
  }
  return true;
};

/** Emit to every socket belonging to a user, if they are connected. */
export const emitToUser = (userId, event, payload) => {
  if (!io || !userId) return false;

  const room = `user:${userId.toString()}`;
  io.to(room).emit(event, payload);
  return true;
};

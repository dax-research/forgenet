/**
 * Holds the Socket.IO server instance so REST handlers can push real-time
 * events without every controller importing the socket layer.
 */
let io = null;

export const setIO = (server) => {
  io = server;
};

export const getIO = () => io;

/** Emit to every socket belonging to a user, if they are connected. */
export const emitToUser = (userId, event, payload) => {
  if (!io || !userId) return false;

  const room = `user:${userId.toString()}`;
  io.to(room).emit(event, payload);
  return true;
};

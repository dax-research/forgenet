import Notification from "./notification.model.js";
import { emitToUser } from "../../services/realtime.service.js";

/**
 * Creates one notification for the recipient.
 *
 * Rules enforced here so no call site can get it wrong:
 *  - never notify yourself (sender === recipient)
 *  - the database is the source of truth; the socket emit is best-effort,
 *    so an offline recipient still has the notification when they return
 *  - `dedupeKey` (if given) prevents duplicates when the same logical action
 *    can arrive through more than one path (e.g. REST + Socket.IO)
 *
 * Returns the created notification, or null when it was skipped.
 */
export const createNotification = async ({
  recipientId,
  senderId = null,
  type,
  message,
  data = {},
  dedupeKey = null,
}) => {
  if (!recipientId) return null;
  if (senderId && senderId.toString() === recipientId.toString()) return null;

  if (dedupeKey) {
    const existing = await Notification.findOne({
      recipient: recipientId,
      "data.dedupeKey": dedupeKey,
    }).lean();
    if (existing) return null;
  }

  let notification;
  try {
    notification = await Notification.create({
      recipient: recipientId,
      sender: senderId,
      type,
      message,
      data: dedupeKey ? { ...data, dedupeKey } : data,
    });
  } catch (error) {
    if (error.code === 11000) return null;
    throw error;
  }

  await notification.populate("sender", "name profileImage");
  emitToUser(recipientId, "notification:new", notification.toJSON());

  return notification;
};

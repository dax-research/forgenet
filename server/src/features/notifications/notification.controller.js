import Notification from "./notification.model.js";
import { emitToUser } from "../../services/realtime.service.js";

const parsePagination = (req, defaultLimit = 10, maxLimit = 50) => {
    const rawLimit = Number.parseInt(req.query.limit ?? String(defaultLimit), 10);
    const rawSkip = Number.parseInt(req.query.skip ?? "0", 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : defaultLimit;
    const skip = Number.isFinite(rawSkip) && rawSkip >= 0 ? rawSkip : 0;
    return { limit, skip };
};

export const getNotifications = async (req, res) => {
    const { limit, skip } = parsePagination(req);
    const filter = { recipient: req.user._id };
    if (req.query.unread === "true") {
        filter.read = false;
    }

    const total = await Notification.countDocuments(filter);
    const unreadCount = await Notification.countDocuments({ recipient: req.user._id, read: false });
    const notifications = await Notification.find(filter).populate("sender", "name profileImage").sort({ createdAt: -1 }).skip(skip).limit(limit);
    return res.json({ success: true, data: { notifications, total, unreadCount, limit, skip } });
};

// GET /api/v1/notifications/unread-count
// Lightweight endpoint backing the sidebar badge; the database stays the source of truth.
export const getUnreadCount = async (req, res) => {
    const unreadCount = await Notification.countDocuments({ recipient: req.user._id, read: false });
    return res.json({ success: true, data: { unreadCount } });
};

export const getNotification = async (req, res) => {
    const notification = await Notification.findOne({ _id: req.params.id, recipient: req.user._id }).populate("sender", "name profileImage");
    if (!notification) return res.status(404).json({ success: false, message: "Notification not found" });
    return res.json({ success: true, data: { notification } });
};
export const createNotification = async (req, res) => res.status(201).json({ success: true, data: { notification: await Notification.create({ ...req.body, recipient: req.body.recipient || req.user._id }) } });
export const updateNotification = async (req, res) => {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ success: false, message: "Notification not found" });
    if (notification.recipient.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: "You are not authorized to modify this notification" });
    Object.assign(notification, { read: req.body.read ?? true });
    await notification.save();
    return res.json({ success: true, data: { notification } });
};
export const markAllAsRead = async (req, res) => {
    const result = await Notification.updateMany(
        { recipient: req.user._id, read: false },
        { $set: { read: true } }
    );

    const unreadCount = await Notification.countDocuments({ recipient: req.user._id, read: false });
    emitToUser(req.user._id, "notification:read_all", { unreadCount });

    return res.json({
        success: true,
        message: "All notifications marked as read",
        data: { updatedCount: result.modifiedCount, unreadCount }
    });
};

export const deleteNotification = async (req, res) => {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ success: false, message: "Notification not found" });
    if (notification.recipient.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: "You are not authorized to modify this notification" });
    await notification.deleteOne();
    return res.json({ success: true, message: "Notification deleted successfully" });
};
import Notification from "./notification.model.js";

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
    const total = await Notification.countDocuments(filter);
    const notifications = await Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
    return res.json({ success: true, data: { notifications, total, limit, skip } });
};
export const getNotification = async (req, res) => {
    const notification = await Notification.findOne({ _id: req.params.id, recipient: req.user._id });
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
export const deleteNotification = async (req, res) => {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ success: false, message: "Notification not found" });
    if (notification.recipient.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: "You are not authorized to modify this notification" });
    await notification.deleteOne();
    return res.json({ success: true, message: "Notification deleted successfully" });
};
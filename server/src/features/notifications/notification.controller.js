import Notification from "./notification.model.js";

export const getNotifications = async (req, res) => res.json({ success: true, data: { notifications: await Notification.find({ recipient: req.user._id }).sort({ createdAt: -1 }) } });
export const getNotification = async (req, res) => {
    const notification = await Notification.findOne({ _id: req.params.id, recipient: req.user._id });
    if (!notification) return res.status(404).json({ success: false, message: "Notification not found" });
    return res.json({ success: true, data: { notification } });
};
export const createNotification = async (req, res) => res.status(201).json({ success: true, data: { notification: await Notification.create({ ...req.body, recipient: req.body.recipient || req.user._id }) } });
export const updateNotification = async (req, res) => {
    const notification = await Notification.findOneAndUpdate({ _id: req.params.id, recipient: req.user._id }, { $set: { ...req.body, read: req.body.read ?? true } }, { new: true, runValidators: true });
    if (!notification) return res.status(404).json({ success: false, message: "Notification not found" });
    return res.json({ success: true, data: { notification } });
};
export const deleteNotification = async (req, res) => {
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
    if (!notification) return res.status(404).json({ success: false, message: "Notification not found" });
    return res.json({ success: true, message: "Notification deleted successfully" });
};
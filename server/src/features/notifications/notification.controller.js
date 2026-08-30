import mongoose from "mongoose";
import Notification from "./notification.model.js";

const isValidId = (value) => mongoose.isValidObjectId(value);

export const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ recipient: req.user._id })
            .populate("sender", "name profileImage")
            .sort({ createdAt: -1 });

        return res.status(200).json({ success: true, data: { notifications } });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getNotification = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid notification id" });
        }

        const notification = await Notification.findOne({ _id: req.params.id, recipient: req.user._id })
            .populate("sender", "name profileImage");

        if (!notification) {
            return res.status(404).json({ success: false, message: "Notification not found" });
        }

        return res.status(200).json({ success: true, data: { notification } });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const createNotification = async (req, res) => {
    try {
        const { type, message, sender, data = {}, read = false } = req.body;

        if (!type || !type.trim()) {
            return res.status(400).json({ success: false, message: "Notification type is required" });
        }

        if (!message || !message.trim()) {
            return res.status(400).json({ success: false, message: "Notification message is required" });
        }

        if (sender && !isValidId(sender)) {
            return res.status(400).json({ success: false, message: "Invalid sender id" });
        }

        const notification = await Notification.create({
            recipient: req.user._id,
            sender: sender || null,
            type: type.trim(),
            message: message.trim(),
            read,
            data
        });

        const populatedNotification = await Notification.findById(notification._id)
            .populate("sender", "name profileImage");

        return res.status(201).json({ success: true, data: { notification: populatedNotification } });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const updateNotification = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid notification id" });
        }

        const allowedFields = ["type", "message", "data", "read"];
        const updates = {};

        for (const field of allowedFields) {
            if (Object.prototype.hasOwnProperty.call(req.body, field)) {
                updates[field] = req.body[field];
            }
        }

        if (updates.type !== undefined && (!updates.type || !updates.type.trim())) {
            return res.status(400).json({ success: false, message: "Notification type is required" });
        }

        if (updates.message !== undefined && (!updates.message || !updates.message.trim())) {
            return res.status(400).json({ success: false, message: "Notification message is required" });
        }

        if (updates.type) updates.type = updates.type.trim();
        if (updates.message) updates.message = updates.message.trim();

        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, recipient: req.user._id },
            { $set: updates },
            { new: true, runValidators: true }
        ).populate("sender", "name profileImage");

        if (!notification) {
            return res.status(404).json({ success: false, message: "Notification not found" });
        }

        return res.status(200).json({ success: true, data: { notification } });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const deleteNotification = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid notification id" });
        }

        const notification = await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });

        if (!notification) {
            return res.status(404).json({ success: false, message: "Notification not found" });
        }

        return res.status(200).json({ success: true, message: "Notification deleted successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
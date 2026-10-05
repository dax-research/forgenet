import mongoose from "mongoose";
import Conversation from "./conversation.model.js";
import Message from "./message.model.js";
import User from "../users/user.model.js";
import { createNotification } from "../notifications/notification.service.js";
import { emitToUser } from "../../services/realtime.service.js";

const valid = (id) => mongoose.isValidObjectId(id);
const member = (conversation, userId) => conversation.participants.some((id) => id.toString() === userId.toString());

/**
 * Notifies the recipient of a new direct message and pushes the sender's
 * unread badge count. Safe to call for both REST and Socket.IO sends because
 * it runs exactly once per persisted message.
 */
export const notifyMessageSent = async (message, senderId) => {
  const conversation = await Conversation.findById(message.conversation);
  if (!conversation) return;

  const recipient = conversation.participants.find(
    (id) => id.toString() !== senderId.toString()
  );
  if (!recipient) return;

  await createNotification({
    recipientId: recipient,
    senderId,
    type: "message",
    message: `New message: ${message.content.slice(0, 80)}`,
    data: { conversationId: message.conversation.toString(), messageId: message._id.toString() },
    // One notification per message, no matter which transport created it.
    dedupeKey: `message:${message._id}`,
  });

  const conversations = await Conversation.find({ participants: recipient }).select("_id");
  const unreadCount = await Message.countDocuments({
    conversation: { $in: conversations.map((c) => c._id) },
    sender: { $ne: recipient },
    readAt: null,
    status: { $in: ["sent", null] },
  });
  emitToUser(recipient, "messages:unread_count", { unreadCount, conversationId: message.conversation.toString() });
};

const parsePagination = (req, defaultLimit = 10, maxLimit = 50) => {
    const rawLimit = Number.parseInt(req.query.limit ?? String(defaultLimit), 10);
    const rawSkip = Number.parseInt(req.query.skip ?? "0", 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : defaultLimit;
    const skip = Number.isFinite(rawSkip) && rawSkip >= 0 ? rawSkip : 0;
    return { limit, skip };
};

export const getConversations = async (req, res) => {
    const { limit, skip } = parsePagination(req);
    const filter = { participants: req.user._id };
    const total = await Conversation.countDocuments(filter);
    const conversations = await Conversation.find(filter).populate("participants", "name profileImage").sort({ updatedAt: -1 }).skip(skip).limit(limit);

    // Per-conversation unread counts, derived from Message.readAt.
    const unreadRows = conversations.length
        ? await Message.aggregate([
              {
                  $match: {
                      conversation: { $in: conversations.map((c) => c._id) },
                      sender: { $ne: req.user._id },
                      readAt: null,
                      // Missing status means a pre-scheduling message, which
                      // counts as delivered.
                      status: { $in: ["sent", null] },
                  },
              },
              { $group: { _id: "$conversation", count: { $sum: 1 } } },
          ])
        : [];

    const unreadMap = {};
    for (const row of unreadRows) unreadMap[row._id.toString()] = row.count;
    const unreadCount = unreadRows.reduce((sum, row) => sum + row.count, 0);

    const withUnread = conversations.map((c) => ({
        ...c.toObject(),
        unreadCount: unreadMap[c._id.toString()] || 0
    }));

    return res.json({ success: true, data: { conversations: withUnread, total, unreadCount, limit, skip } });
};

export const getConversation = async (req, res) => {
    const conversation = await Conversation.findById(req.params.id).populate("participants", "name profileImage");
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found" });
    if (!member(conversation, req.user._id)) return res.status(403).json({ success: false, message: "Forbidden" });
    return res.json({ success: true, data: { conversation } });
};

export const createConversation = async (req, res) => {
    const participantId = req.body?.participantId;
    const userId = req.user._id.toString();

    // Validate participantId presence
    if (!participantId) return res.status(400).json({ success: false, message: "participantId is required" });
    // Validate ObjectId format
    if (!valid(participantId)) return res.status(400).json({ success: false, message: "Invalid participant ID" });
    // Prevent self‑conversation
    if (participantId === userId) return res.status(400).json({ success: false, message: "You cannot create a conversation with yourself" });

    // Verify participant exists
    const participant = await User.findById(participantId).select("_id name profileImage");
    if (!participant) return res.status(404).json({ success: false, message: "Participant not found" });

    // Look for existing conversation regardless of order, exactly two participants
    const existing = await Conversation.findOne({
        participants: { $all: [userId, participantId] },
        $expr: { $eq: [{ $size: "$participants" }, 2] }
    }).populate("participants", "name profileImage");

    if (existing) {
        return res.status(200).json({ success: true, message: "Conversation already exists", data: { conversation: existing } });
    }

    const conversation = await Conversation.create({ participants: [userId, participantId] });
    await conversation.populate("participants", "name profileImage");
    return res.status(201).json({ success: true, message: "Conversation created", data: { conversation } });
};

export const updateConversation = async (req, res) => {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found" });
    if (!member(conversation, req.user._id)) return res.status(403).json({ success: false, message: "Forbidden" });
    conversation.title = req.body?.title ?? conversation.title;
    await conversation.save();
    return res.json({ success: true, data: { conversation } });
};

export const deleteConversation = async (req, res) => {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found" });
    if (!member(conversation, req.user._id)) return res.status(403).json({ success: false, message: "Forbidden" });
    await Message.deleteMany({ conversation: conversation._id });
    await conversation.deleteOne();
    return res.json({ success: true, message: "Conversation deleted successfully" });
};

export const getMessages = async (req, res) => {
    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation || !member(conversation, req.user._id)) return res.status(404).json({ success: false, message: "Conversation not found" });
    const { limit, skip } = parsePagination(req, 20, 100);
    const filter = { conversation: conversation._id };
    const total = await Message.countDocuments(filter);
    // Only delivered messages; pending scheduled ones are private to the sender
    // until the scheduler sends them.
    const messages = await Message.find({ ...filter, status: { $in: ["sent", null] } })
        .populate("sender", "name profileImage")
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit);
    return res.json({ success: true, data: { messages, total, limit, skip } });
};

export const createMessage = async (req, res) => {
    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation || !member(conversation, req.user._id)) return res.status(404).json({ success: false, message: "Conversation not found" });
    if (!req.body.content?.trim()) return res.status(400).json({ success: false, message: "Message content is required" });
    const message = await Message.create({
            conversation: conversation._id,
            sender: req.user._id,
            content: req.body.content,
            // Instant send: delivered immediately, never scheduled.
            status: "sent",
            sentAt: new Date()
        });
        await Conversation.findByIdAndUpdate(conversation._id, { updatedAt: new Date() });
        await notifyMessageSent(message, req.user._id);
        return res.status(201).json({ success: true, data: { message } });
    };

export const updateMessage = async (req, res) => {
    const message = await Message.findOneAndUpdate(
        // status "sent" or absent (pre-scheduling message)
        { _id: req.params.id, sender: req.user._id, status: { $in: ["sent", null] } },
        { content: req.body?.content, readAt: req.body?.readAt },
        { new: true, runValidators: true }
    );
    if (!message) return res.status(404).json({ success: false, message: "Message not found" });
    return res.json({ success: true, data: { message } });
};

export const deleteMessage = async (req, res) => {
    // A pending scheduled message must be cancelled, not hard-deleted, so the
    // recipient can never receive it later.
    const message = await Message.findOne({ _id: req.params.id, sender: req.user._id });
    if (!message) return res.status(404).json({ success: false, message: "Message not found" });
    if (message.status === "scheduled") {
        return res.status(409).json({
            success: false,
            message: "Cancel the scheduled message instead of deleting it"
        });
    }
    await message.deleteOne();
    return res.json({ success: true, message: "Message deleted successfully" });
};
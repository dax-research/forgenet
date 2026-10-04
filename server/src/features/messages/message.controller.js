import mongoose from "mongoose";
import Conversation from "../chat/conversation.model.js";
import Message from "./message.model.js";
import User from "../users/user.model.js"; // for potential future checks
import { emitToUser } from "../../services/realtime.service.js";

const valid = (id) => mongoose.isValidObjectId(id);

// Helper to verify user is participant
const isParticipant = async (conversationId, userId) => {
  const convo = await Conversation.findById(conversationId);
  if (!convo) return null;
  const member = convo.participants.some((pid) => pid.toString() === userId.toString());
  return member ? convo : null;
};

/**
 * Total unread messages for a user across every conversation they participate
 * in. A message is unread for a given user when it was sent by someone else
 * and its readAt is still null — readAt on the document is the source of truth.
 */
export const countUnread = async (userId) => {
  const conversations = await Conversation.find({ participants: userId }).select("_id");
  const conversationIds = conversations.map((c) => c._id);

  if (conversationIds.length === 0) return 0;

  return Message.countDocuments({
    conversation: { $in: conversationIds },
    sender: { $ne: userId },
    readAt: null,
  });
};

// GET /api/v1/messages/unread-count
export const getUnreadCount = async (req, res) => {
  const unreadCount = await countUnread(req.user._id);
  return res.json({ success: true, data: { unreadCount } });
};

// PUT /api/v1/messages/conversation/:conversationId/read
// Marks every message in the conversation as read for the requesting participant.
export const markConversationRead = async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user._id;

  if (!valid(conversationId)) {
    return res.status(400).json({ success: false, message: "Invalid conversation ID" });
  }

  const conversation = await isParticipant(conversationId, userId);
  if (!conversation) {
    const exists = await Conversation.findById(conversationId);
    if (!exists) return res.status(404).json({ success: false, message: "Conversation not found" });
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  const result = await Message.updateMany(
    { conversation: conversation._id, sender: { $ne: userId }, readAt: null },
    { $set: { readAt: new Date() } }
  );

  const unreadCount = await countUnread(userId);
  emitToUser(userId, "messages:unread_count", { unreadCount });

  return res.json({ success: true, data: { updatedCount: result.modifiedCount, unreadCount } });
};

/**
 * POST /api/v1/messages
 * Create a new message in a conversation.
 */
export const createMessage = async (req, res) => {
  const { conversationId, content } = req.body;
  const senderId = req.user._id;

  // Validate required fields
  if (!conversationId) {
    return res.status(400).json({ success: false, message: "conversationId is required" });
  }
  if (!valid(conversationId)) {
    return res.status(400).json({ success: false, message: "Invalid conversation ID" });
  }
  if (!content || !content.trim()) {
    return res.status(400).json({ success: false, message: "Message content is required" });
  }

  // Verify conversation exists and user participates
  const conversation = await isParticipant(conversationId, senderId);
  if (!conversation) {
    // Distinguish between not found and forbidden
    const exists = await Conversation.findById(conversationId);
    if (!exists) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  const message = await Message.create({
    conversation: conversationId,
    sender: senderId,
    content: content.trim()
  });

  // Update conversation's updatedAt for ordering (optional, mirrors chat controller)
  await Conversation.findByIdAndUpdate(conversationId, { updatedAt: new Date() });

  const populated = await message.populate("sender", "name profileImage");
  return res.status(201).json({ success: true, data: { message: populated } });
};

/**
 * GET /api/v1/messages/conversation/:conversationId
 * Retrieve all messages for a conversation (chronological order).
 */
export const getMessages = async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user._id;

  if (!valid(conversationId)) {
    return res.status(400).json({ success: false, message: "Invalid conversation ID" });
  }

  const conversation = await isParticipant(conversationId, userId);
  if (!conversation) {
    const exists = await Conversation.findById(conversationId);
    if (!exists) return res.status(404).json({ success: false, message: "Conversation not found" });
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  const messages = await Message.find({ conversation: conversationId })
    .populate("sender", "name profileImage")
    .sort({ createdAt: 1 });

  return res.json({ success: true, data: { messages } });
};

/**
 * GET /api/v1/messages/:id
 * Retrieve a single message (must belong to a conversation the user participates in).
 */
export const getMessage = async (req, res) => {
  const { id } = req.params;
  if (!valid(id)) {
    return res.status(400).json({ success: false, message: "Invalid message ID" });
  }

  const message = await Message.findById(id).populate("sender", "name profileImage");
  if (!message) return res.status(404).json({ success: false, message: "Message not found" });

  // Verify user is part of the conversation
  const isMember = message.conversation && (await isParticipant(message.conversation, req.user._id));
  if (!isMember) return res.status(403).json({ success: false, message: "Forbidden" });

  return res.json({ success: true, data: { message } });
};

/**
 * PUT /api/v1/messages/:id
 * Update a message (only the sender can update).
 */
export const updateMessage = async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  const senderId = req.user._id;

  if (!valid(id)) {
    return res.status(400).json({ success: false, message: "Invalid message ID" });
  }
  if (!content || !content.trim()) {
    return res.status(400).json({ success: false, message: "Message content is required" });
  }

  // Ensure the message belongs to the sender
  const message = await Message.findOneAndUpdate(
    { _id: id, sender: senderId },
    { content: content.trim() },
    { new: true, runValidators: true }
  ).populate("sender", "name profileImage");

  if (!message) return res.status(404).json({ success: false, message: "Message not found or not authorized" });

  return res.json({ success: true, data: { message } });
};

/**
 * DELETE /api/v1/messages/:id
 * Delete a message (only the sender can delete).
 */
export const deleteMessage = async (req, res) => {
  const { id } = req.params;
  const senderId = req.user._id;

  if (!valid(id)) {
    return res.status(400).json({ success: false, message: "Invalid message ID" });
  }

  const message = await Message.findOneAndDelete({ _id: id, sender: senderId });
  if (!message) return res.status(404).json({ success: false, message: "Message not found or not authorized" });

  return res.json({ success: true, message: "Message deleted successfully" });
};

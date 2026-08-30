import mongoose from "mongoose";
import Conversation from "./conversation.model.js";
import Message from "./message.model.js";

const valid = (id) => mongoose.isValidObjectId(id);
const member = (conversation, userId) => conversation.participants.some((id) => id.toString() === userId.toString());

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
    return res.json({ success: true, data: { conversations, total, limit, skip } });
};

export const getConversation = async (req, res) => {
    const conversation = await Conversation.findById(req.params.id).populate("participants", "name profileImage");
    if (!conversation || !member(conversation, req.user._id)) return res.status(404).json({ success: false, message: "Conversation not found" });
    return res.json({ success: true, data: { conversation } });
};

export const createConversation = async (req, res) => {
    const participants = [...new Set([req.user._id.toString(), ...(req.body.participants || [])])];
    if (participants.length < 2 || participants.some((id) => !valid(id))) return res.status(400).json({ success: false, message: "At least one valid participant is required" });
    const conversation = await Conversation.create({ participants, title: req.body.title });
    return res.status(201).json({ success: true, data: { conversation } });
};

export const updateConversation = async (req, res) => {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || !member(conversation, req.user._id)) return res.status(404).json({ success: false, message: "Conversation not found" });
    conversation.title = req.body.title ?? conversation.title;
    await conversation.save();
    return res.json({ success: true, data: { conversation } });
};

export const deleteConversation = async (req, res) => {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || !member(conversation, req.user._id)) return res.status(404).json({ success: false, message: "Conversation not found" });
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
    const messages = await Message.find(filter).populate("sender", "name profileImage").sort({ createdAt: 1 }).skip(skip).limit(limit);
    return res.json({ success: true, data: { messages, total, limit, skip } });
};

export const createMessage = async (req, res) => {
    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation || !member(conversation, req.user._id)) return res.status(404).json({ success: false, message: "Conversation not found" });
    if (!req.body.content?.trim()) return res.status(400).json({ success: false, message: "Message content is required" });
    const message = await Message.create({ conversation: conversation._id, sender: req.user._id, content: req.body.content });
    await Conversation.findByIdAndUpdate(conversation._id, { updatedAt: new Date() });
    return res.status(201).json({ success: true, data: { message } });
};

export const updateMessage = async (req, res) => {
    const message = await Message.findOneAndUpdate({ _id: req.params.id, sender: req.user._id }, { content: req.body.content, readAt: req.body.readAt }, { new: true, runValidators: true });
    if (!message) return res.status(404).json({ success: false, message: "Message not found" });
    return res.json({ success: true, data: { message } });
};

export const deleteMessage = async (req, res) => {
    const message = await Message.findOneAndDelete({ _id: req.params.id, sender: req.user._id });
    if (!message) return res.status(404).json({ success: false, message: "Message not found" });
    return res.json({ success: true, message: "Message deleted successfully" });
};
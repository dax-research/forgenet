import mongoose from "mongoose";
import Community from "./community.model.js";

const isOwner = (community, userId) => community.owner.toString() === userId.toString();

const parsePagination = (req, defaultLimit = 10, maxLimit = 50) => {
    const rawLimit = Number.parseInt(req.query.limit ?? String(defaultLimit), 10);
    const rawSkip = Number.parseInt(req.query.skip ?? "0", 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : defaultLimit;
    const skip = Number.isFinite(rawSkip) && rawSkip >= 0 ? rawSkip : 0;
    return { limit, skip };
};

export const createCommunity = async (req, res) => {
    try {
        const { name, description, image } = req.body;
        const owner = req.user._id;
        const community = await Community.create({ name, description, owner, admins: [owner], members: [owner], image });
        return res.status(201).json({ success: true, message: "Community created successfully", data: { community } });
    } catch (error) {
        const status = error.code === 11000 ? 409 : error.name === "ValidationError" ? 400 : 500;
        return res.status(status).json({ success: false, message: status === 500 ? "Internal server error" : error.message });
    }
};

export const getCommunities = async (req, res) => {
    const { limit, skip } = parsePagination(req);
    const total = await Community.countDocuments();
    const communities = await Community.find().populate("owner", "name profileImage").sort({ createdAt: -1 }).skip(skip).limit(limit);
    return res.status(200).json({ success: true, data: { communities, total, limit, skip } });
};

export const getCommunity = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ success: false, message: "Invalid community ID" });
    }
    const community = await Community.findById(req.params.id)
        .populate("owner", "name profileImage")
        .populate("admins", "name profileImage")
        .populate("members", "name profileImage");
    if (!community) {
        return res.status(404).json({ success: false, message: "Community not found" });
    }
    return res.status(200).json({ success: true, data: { community } });
};

export const updateCommunity = async (req, res) => {
    const { name, description, image } = req.body;
    const community = await Community.findById(req.params.id);
    if (!community) {
        return res.status(404).json({ success: false, message: "Community not found" });
    }
    if (!isOwner(community, req.user._id)) {
        return res.status(403).json({ success: false, message: "You are not authorized to modify this community" });
    }
    Object.assign(community, { name, description, image });
    await community.save();
    return res.status(200).json({ success: true, message: "Community updated successfully", data: { community } });
};

export const deleteCommunity = async (req, res) => {
    const community = await Community.findById(req.params.id);
    if (!community) {
        return res.status(404).json({ success: false, message: "Community not found" });
    }
    if (!isOwner(community, req.user._id)) {
        return res.status(403).json({ success: false, message: "Only the community owner can delete this community" });
    }
    await community.deleteOne();
    return res.status(200).json({ success: true, message: "Community deleted successfully" });
};

export const joinCommunity = async (req, res) => {
    const community = await Community.findById(req.params.id);
    if (!community) {
        return res.status(404).json({ success: false, message: "Community not found" });
    }
    if (community.members.some((member) => member.toString() === req.user._id.toString())) {
        return res.status(409).json({ success: false, message: "User is already a member" });
    }
    const updatedCommunity = await Community.findOneAndUpdate(
        { _id: req.params.id, members: { $ne: req.user._id } },
        { $addToSet: { members: req.user._id } },
        { new: true }
    );
    if (!updatedCommunity) {
        return res.status(409).json({ success: false, message: "User is already a member" });
    }
    return res.status(200).json({ success: true, message: "Joined community successfully", data: { community: updatedCommunity } });
};

export const leaveCommunity = async (req, res) => {
    const community = await Community.findById(req.params.id);
    if (!community) {
        return res.status(404).json({ success: false, message: "Community not found" });
    }
    if (isOwner(community, req.user._id)) {
        return res.status(409).json({ success: false, message: "The owner cannot leave the community" });
    }
    const updatedCommunity = await Community.findOneAndUpdate(
        { _id: req.params.id },
        { $pull: { members: req.user._id, admins: req.user._id } },
        { new: true }
    );
    return res.status(200).json({ success: true, message: "Left community successfully", data: { community: updatedCommunity } });
};

export const searchCommunities = async (req, res) => {
    const query = req.query.q?.trim();
    if (!query) return res.status(400).json({ success: false, message: "Search query is required" });
    const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const communities = await Community.find({ $or: [{ name: pattern }, { description: pattern }] }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: { communities } });
};

export const getMembers = async (req, res) => {
    const community = await Community.findById(req.params.id).populate("members", "name profileImage skills");
    if (!community) return res.status(404).json({ success: false, message: "Community not found" });
    return res.status(200).json({ success: true, data: { members: community.members } });
};
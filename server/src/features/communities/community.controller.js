import mongoose from "mongoose";
import Community from "./community.model.js";
import { createNotification } from "../notifications/notification.service.js";

const isOwner = (community, userId) => community.owner.toString() === userId.toString();
const isAdmin = (community, userId) =>
    isOwner(community, userId) ||
    community.admins.some((admin) => admin.toString() === userId.toString());
const isMember = (community, userId) =>
    community.members.some((member) =>
        (member._id ?? member).toString() === userId.toString()
    );

/**
 * Membership state of `userId` relative to the community, used by the frontend
 * so the UI does not have to re-derive it.
 */
export const getMembershipState = (community, userId) => {
    if (!userId) return { role: "NONE", isMember: false, isAdmin: false, isOwner: false, hasPendingRequest: false };

    const owner = isOwner(community, userId);
    const admin = owner || community.admins.some((a) => a.toString() === userId.toString());
    const member = isMember(community, userId);
    const request = community.joinRequests?.find((r) => r.user.toString() === userId.toString());

    return {
        role: owner ? "OWNER" : admin ? "ADMIN" : member ? "MEMBER" : "NONE",
        isOwner: owner,
        isAdmin: admin,
        isMember: member || owner,
        hasPendingRequest: request?.status === "pending"
    };
};

const parsePagination = (req, defaultLimit = 10, maxLimit = 50) => {
    const rawLimit = Number.parseInt(req.query.limit ?? String(defaultLimit), 10);
    const rawSkip = Number.parseInt(req.query.skip ?? "0", 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : defaultLimit;
    const skip = Number.isFinite(rawSkip) && rawSkip >= 0 ? rawSkip : 0;
    return { limit, skip };
};

export const createCommunity = async (req, res) => {
    try {
        const { name, description, image, joinMode } = req.body;
        const owner = req.user._id;
        const community = await Community.create({
            name,
            description,
            owner,
            admins: [owner],
            members: [owner],
            image,
            joinMode: joinMode === "APPROVAL_REQUIRED" ? "APPROVAL_REQUIRED" : "OPEN"
        });
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
    const withState = communities.map((community) => ({
        ...community.toObject(),
        membership: getMembershipState(community, req.user?._id)
    }));
    return res.status(200).json({ success: true, data: { communities: withState, total, limit, skip } });
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

    // Join requests are only visible to the owner/admins of the community.
    const viewerCanModerate = req.user && isAdmin(community, req.user._id);
    const payload = community.toObject();
    payload.membership = getMembershipState(community, req.user?._id);
    payload.memberCount = community.members?.length || 0;
    payload.joinRequestCount = viewerCanModerate
        ? community.joinRequests.filter((r) => r.status === "pending").length
        : undefined;

    return res.status(200).json({ success: true, data: { community: payload } });
};

export const updateCommunity = async (req, res) => {
    const { name, description, image, joinMode } = req.body;
    const community = await Community.findById(req.params.id);
    if (!community) {
        return res.status(404).json({ success: false, message: "Community not found" });
    }
    if (!isOwner(community, req.user._id)) {
        return res.status(403).json({ success: false, message: "You are not authorized to modify this community" });
    }
    if (name !== undefined) community.name = name;
    if (description !== undefined) community.description = description;
    if (image !== undefined) community.image = image;
    if (joinMode === "OPEN" || joinMode === "APPROVAL_REQUIRED") community.joinMode = joinMode;
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
    if (isMember(community, req.user._id)) {
        return res.status(409).json({ success: false, message: "User is already a member" });
    }

    // Approval-required community: create a pending request instead of joining.
    if (community.joinMode === "APPROVAL_REQUIRED") {
        const existing = community.joinRequests.find(
            (r) => r.user.toString() === req.user._id.toString() && r.status === "pending"
        );
        if (existing) {
            return res.status(409).json({ success: false, message: "A join request is already pending" });
        }

        // Drop any previously resolved request before adding a fresh one.
        community.joinRequests = community.joinRequests.filter(
            (r) => r.user.toString() !== req.user._id.toString()
        );
        community.joinRequests.push({ user: req.user._id, status: "pending", message: req.body.message || "" });
        await community.save();

        await createNotification({
            recipientId: community.owner,
            senderId: req.user._id,
            type: "community",
            message: `${req.user.name} requested to join ${community.name}.`,
            data: { communityId: community._id.toString(), action: "join_request" },
            dedupeKey: `community:${community._id}:join_request:${req.user._id}`
        });

        return res.status(200).json({
            success: true,
            message: "Join request submitted and awaiting approval",
            data: { membership: getMembershipState(community, req.user._id) }
        });
    }

    const updatedCommunity = await Community.findOneAndUpdate(
        { _id: req.params.id, members: { $ne: req.user._id } },
        { $addToSet: { members: req.user._id }, $pull: { joinRequests: { user: req.user._id } } },
        { new: true }
    );
    if (!updatedCommunity) {
        return res.status(409).json({ success: false, message: "User is already a member" });
    }
    return res.status(200).json({
        success: true,
        message: "Joined community successfully",
        data: { community: updatedCommunity, membership: getMembershipState(updatedCommunity, req.user._id) }
    });
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
    return res.status(200).json({
        success: true,
        message: "Left community successfully",
        data: { community: updatedCommunity, membership: getMembershipState(updatedCommunity, req.user._id) }
    });
};

// GET /api/v1/communities/:id/join-requests — owner/admins only.
export const getJoinRequests = async (req, res) => {
    const community = await Community.findById(req.params.id).populate("joinRequests.user", "name profileImage");
    if (!community) return res.status(404).json({ success: false, message: "Community not found" });
    if (!isAdmin(community, req.user._id)) {
        return res.status(403).json({ success: false, message: "Only community admins can view join requests" });
    }
    const requests = community.joinRequests
        .filter((r) => r.status === "pending")
        .map((r) => ({
            _id: r._id.toString(),
            user: r.user,
            status: r.status,
            message: r.message,
            createdAt: r.createdAt
        }));
    return res.status(200).json({ success: true, data: { requests } });
};

// PATCH /api/v1/communities/:id/join-requests/:requestId — owner/admins only.
export const respondToJoinRequest = async (req, res) => {
    const decision = req.body.decision;
    if (!["approve", "reject"].includes(decision)) {
        return res.status(400).json({ success: false, message: "decision must be 'approve' or 'reject'" });
    }

    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ success: false, message: "Community not found" });
    if (!isAdmin(community, req.user._id)) {
        return res.status(403).json({ success: false, message: "Only community admins can manage join requests" });
    }

    const request = community.joinRequests.find(
        (r) => r._id.toString() === req.params.requestId && r.status === "pending"
    );
    if (!request) {
        return res.status(404).json({ success: false, message: "Pending join request not found" });
    }

    const requesterId = request.user.toString();

    if (decision === "approve") {
        request.status = "approved";
        if (!community.members.some((m) => m.toString() === requesterId)) {
            community.members.push(request.user);
        }
    } else {
        request.status = "rejected";
    }
    await community.save();

    await createNotification({
        recipientId: request.user,
        senderId: req.user._id,
        type: "community",
        message:
            decision === "approve"
                ? `Your request to join ${community.name} was approved.`
                : `Your request to join ${community.name} was rejected.`,
        data: { communityId: community._id.toString(), action: decision === "approve" ? "approved" : "rejected" },
        dedupeKey: `community:${community._id}:join_decision:${request._id}`
    });

    return res.status(200).json({
        success: true,
        message: decision === "approve" ? "Join request approved" : "Join request rejected",
        data: { community, membership: getMembershipState(community, req.user._id) }
    });
};

// DELETE /api/v1/communities/:id/join-requests/:requestId — requester cancels their own request.
export const cancelJoinRequest = async (req, res) => {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ success: false, message: "Community not found" });

    const request = community.joinRequests.find(
        (r) => r._id.toString() === req.params.requestId && r.status === "pending"
    );
    if (!request) {
        return res.status(404).json({ success: false, message: "Pending join request not found" });
    }
    if (request.user.toString() !== req.user._id.toString() && !isAdmin(community, req.user._id)) {
        return res.status(403).json({ success: false, message: "You cannot cancel this join request" });
    }

    community.joinRequests = community.joinRequests.filter(
        (r) => r._id.toString() !== req.params.requestId
    );
    await community.save();

    return res.status(200).json({ success: true, message: "Join request cancelled" });
};

export const searchCommunities = async (req, res) => {
    const query = req.query.q?.trim();
    if (!query) return res.status(400).json({ success: false, message: "Search query is required" });
    const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const communities = await Community.find({ $or: [{ name: pattern }, { description: pattern }] }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: { communities } });
};

export const getMembers = async (req, res) => {
    const { limit, skip } = parsePagination(req, 20, 100);
    const community = await Community.findById(req.params.id)
        .populate("owner", "name profileImage")
        .populate("admins", "name profileImage")
        .populate("members", "name profileImage skills");
    if (!community) return res.status(404).json({ success: false, message: "Community not found" });

    const owner = community.owner;
    const admins = (community.admins || []).filter((a) => a._id.toString() !== owner?._id?.toString());
    const members = community.members || [];
    const preview = members.slice(skip, skip + limit);

    return res.status(200).json({
        success: true,
        data: {
            owner,
            admins,
            members: preview,
            memberCount: members.length,
            total: members.length,
            limit,
            skip,
            hasMore: skip + limit < members.length
        }
    });
};
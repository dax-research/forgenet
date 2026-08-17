import Community from "./community.model.js";


// Create community
export const createCommunity = async (req, res) => {
    try {
        const { name, description, owner, image } = req.body;

        const community = await Community.create({
            name,
            description,
            owner,
            admins: [owner],
            members: [owner],
            image
        });

        res.status(201).json({
            success: true,
            message: "Community created successfully",
            community
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// Get all communities
export const getCommunities = async (req, res) => {
    try {
        const communities = await Community.find()
            .populate("owner", "name profileImage")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            communities
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// Get single community
export const getCommunity = async (req, res) => {
    try {
        const community = await Community.findById(req.params.id)
            .populate("owner", "name profileImage")
            .populate("admins", "name profileImage")
            .populate("members", "name profileImage");

        if (!community) {
            return res.status(404).json({
                success: false,
                message: "Community not found"
            });
        }

        res.status(200).json({
            success: true,
            community
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// Update community
export const updateCommunity = async (req, res) => {
    try {
        const community = await Community.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true
            }
        );

        if (!community) {
            return res.status(404).json({
                success: false,
                message: "Community not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Community updated successfully",
            community
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// Delete community
export const deleteCommunity = async (req, res) => {
    try {
        const { userId } = req.body;

        const community = await Community.findById(req.params.id);

        if (!community) {
            return res.status(404).json({
                success: false,
                message: "Community not found"
            });
        }

        // Check whether the user is the owner
        if (community.owner.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "Only the community owner can delete this community"
            });
        }

        await Community.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: "Community deleted successfully"
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// Join community
export const joinCommunity = async (req, res) => {
    try {
        const { userId } = req.body;

        const community = await Community.findById(req.params.id);

        if (!community) {
            return res.status(404).json({
                success: false,
                message: "Community not found"
            });
        }

        if (community.members.includes(userId)) {
            return res.status(400).json({
                success: false,
                message: "User is already a member"
            });
        }

        community.members.push(userId);

        await community.save();

        res.status(200).json({
            success: true,
            message: "Joined community successfully",
            community
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// Leave community
export const leaveCommunity = async (req, res) => {
    try {
        const { userId } = req.body;

        const community = await Community.findById(req.params.id);

        if (!community) {
            return res.status(404).json({
                success: false,
                message: "Community not found"
            });
        }

        community.members = community.members.filter(
            member => member.toString() !== userId
        );

        await community.save();

        res.status(200).json({
            success: true,
            message: "Left community successfully",
            community
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
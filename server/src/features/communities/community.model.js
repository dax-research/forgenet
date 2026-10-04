import mongoose from "mongoose";

const joinRequestSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending"
    },
    message: {
        type: String,
        trim: true,
        default: ""
    }
}, { timestamps: true });

// Prevent more than one pending request per user per community.
joinRequestSchema.index({ user: 1, status: 1 }, { unique: true, partialFilterExpression: { status: "pending" } });

const communitySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            unique: true
        },

        description: {
            type: String,
            required: true,
            trim: true
        },

        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        admins: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ],

        members: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ],

        // Membership mode: OPEN = instant join, APPROVAL_REQUIRED = admin approves.
        joinMode: {
            type: String,
            enum: ["OPEN", "APPROVAL_REQUIRED"],
            default: "OPEN"
        },

        joinRequests: [joinRequestSchema],

        image: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

export default mongoose.model("Community", communitySchema);
import mongoose from "mongoose";

const joinRequestSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    status: {
        type: String,
        // "superseded" marks an older request that was replaced by a newer one.
        enum: ["pending", "approved", "rejected", "superseded"],
        default: "pending"
    },
    message: {
        type: String,
        trim: true,
        default: ""
    }
}, { timestamps: true });

// NOTE: deliberately no unique index here. A unique index over an embedded
// array path is enforced across the entire collection, not per document, so
// `{ user: 1, status: 1 }` would allow only ONE pending request per user across
// ALL communities. Duplicate prevention is done atomically in the update filter
// inside joinCommunity() (pending requests are filtered out on every write).

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
        // Defaults to APPROVAL_REQUIRED so a community never silently admits
        // people without the owner ever seeing a request.
        joinMode: {
            type: String,
            enum: ["OPEN", "APPROVAL_REQUIRED"],
            default: "APPROVAL_REQUIRED"
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
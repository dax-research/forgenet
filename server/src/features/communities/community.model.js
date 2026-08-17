import mongoose from "mongoose";

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
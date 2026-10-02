import mongoose from "mongoose";

const mediaItemSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            required: true,
            enum: ["image", "video", "document"],
            default: "image"
        },
        url: {
            type: String,
            required: true,
            trim: true
        },
        filename: {
            type: String,
            trim: true
        },
        mimeType: {
            type: String,
            trim: true
        },
        size: {
            type: Number,
            min: 0
        },
        altText: {
            type: String,
            default: "",
            trim: true
        },
        duration: {
            type: Number,
            min: 0
        }
    },
    { _id: false }
);

const postSchema = new mongoose.Schema(
    {
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        content: {
            type: String,
            required: true,
            trim: true,
            maxlength: [3000, "Post content cannot exceed 3000 characters"]
        },

        images: {
            type: [String],
            default: []
        },

        media: {
            type: [mediaItemSchema],
            default: []
        },

        codeBlocks: [
            {
                language: {
                    type: String,
                    default: "text"
                },

                code: {
                    type: String,
                    required: true
                }
            }
        ],

        tags: {
            type: [String],
            default: []
        },

        community: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Community",
            default: null
        },

        likes: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ]
    },
    {
        timestamps: true
    }
);

export default mongoose.model("Post", postSchema);
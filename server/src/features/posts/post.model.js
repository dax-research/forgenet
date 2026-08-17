import mongoose from "mongoose";

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
            trim: true
        },

        images: {
            type: [String],
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
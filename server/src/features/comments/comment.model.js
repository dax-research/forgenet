import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema(
    {
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        post: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Post",
            required: true
        },

        content: {
            type: String,
            required: true,
            trim: true
        },

        parentComment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Comment",
            default: null
        }
    },
    {
        timestamps: true
    }
);

export default mongoose.model("Comment", commentSchema);
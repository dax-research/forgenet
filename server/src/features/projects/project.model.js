import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        title: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            required: true,
            trim: true
        },

        images: {
            type: [String],
            default: []
        },

        technologies: {
            type: [String],
            default: []
        },

        githubUrl: {
            type: String,
            trim: true
        },

        liveUrl: {
            type: String,
            trim: true
        },

        status: {
            type: String,
            enum: ["completed", "in-progress", "planned"],
            default: "in-progress"
        }
    },
    {
        timestamps: true
    }
);

export default mongoose.model("Project", projectSchema);
import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema({
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
    title: { type: String, trim: true, default: "" }
}, { timestamps: true });

export default mongoose.model("Conversation", conversationSchema);
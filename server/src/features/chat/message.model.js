import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, trim: true },
    readAt: { type: Date, default: null }
}, { timestamps: true });

export default mongoose.model("Message", messageSchema);
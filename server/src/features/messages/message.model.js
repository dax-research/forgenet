import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
  content: { type: String, required: true, trim: true },
  deliveredAt: { type: Date, default: null },
  readAt: { type: Date, default: null }
}, { timestamps: true });

// Index for fast look‑up of messages by conversation
messageSchema.index({ conversation: 1 });

export default mongoose.model("Message", messageSchema);

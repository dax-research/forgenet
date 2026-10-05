import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
  content: { type: String, required: true, trim: true },
  deliveredAt: { type: Date, default: null },
  readAt: { type: Date, default: null },

  // Scheduling. `scheduledAt` is always stored in UTC; the client converts from
  // the user's timezone before sending it. A message with status "scheduled"
  // is invisible to recipients until the backend scheduler sends it.
  scheduledAt: { type: Date, default: null },
  sentAt: { type: Date, default: null },
  status: {
    type: String,
    enum: ["sent", "scheduled", "cancelled"],
    // Existing messages predate this field; treat a missing value as delivered
    // so historical messages stay visible in conversations and unread counts.
    default: "sent"
  },
  scheduledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
}, { timestamps: true });

// Index for fast look‑up of messages by conversation
messageSchema.index({ conversation: 1 });
// Lets the scheduler efficiently find messages that are due, and keeps
// conversation history queries to delivered messages only.
messageSchema.index({ status: 1, scheduledAt: 1 });
// One conversation history query can order by recency for a given status.
messageSchema.index({ conversation: 1, status: 1, createdAt: -1 });

export default mongoose.model("Message", messageSchema);

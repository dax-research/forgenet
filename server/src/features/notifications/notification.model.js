import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
	recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
	sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
	type: { type: String, required: true, trim: true },
	message: { type: String, required: true, trim: true },
	read: { type: Boolean, default: false },
	data: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
// Guards against duplicate notifications for the same logical action.
notificationSchema.index(
	{ recipient: 1, "data.dedupeKey": 1 },
	{ unique: true, partialFilterExpression: { "data.dedupeKey": { $type: "string" } } }
);

export default mongoose.model("Notification", notificationSchema);

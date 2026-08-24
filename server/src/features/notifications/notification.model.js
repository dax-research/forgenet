import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
	recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
	sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
	type: { type: String, required: true, trim: true },
	message: { type: String, required: true, trim: true },
	read: { type: Boolean, default: false },
	data: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

export default mongoose.model("Notification", notificationSchema);

import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { createNotification, deleteNotification, getNotification, getNotifications, getUnreadCount, markAllAsRead, updateNotification } from "./notification.controller.js";

const notificationRouter = Router();
notificationRouter.use(authenticate);
notificationRouter.get("/", getNotifications);
notificationRouter.get("/unread-count", getUnreadCount);
notificationRouter.put("/read-all", markAllAsRead);
notificationRouter.post("/", createNotification);
notificationRouter.get("/:id", getNotification);
notificationRouter.put("/:id", updateNotification);
notificationRouter.delete("/:id", deleteNotification);
export default notificationRouter;
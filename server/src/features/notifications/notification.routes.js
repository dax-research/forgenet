import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { createNotification, deleteNotification, getNotification, getNotifications, updateNotification } from "./notification.controller.js";

const notificationRouter = Router();
notificationRouter.use(authenticate);
notificationRouter.get("/", getNotifications);
notificationRouter.post("/", createNotification);
notificationRouter.get("/:id", getNotification);
notificationRouter.patch("/:id", updateNotification);
notificationRouter.delete("/:id", deleteNotification);
export default notificationRouter;
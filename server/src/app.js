import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { env } from "./config/env.js";

import healthRouter from "./features/health/health.routes.js";
import authRouter from "./features/auth/auth.routes.js";
import userRouter from "./features/users/user.routes.js";
import postRouter from "./features/posts/post.routes.js";
import commentRouter from "./features/comments/comment.routes.js";  
import nestedCommentRouter from "./features/comments/nested-comment.routes.js";
import projectRouter from "./features/projects/project.routes.js";
import communityRouter from "./features/communities/community.routes.js";
import communityPostRouter from "./features/communities/community-post.routes.js";
import chatRouter from "./features/chat/chat.routes.js";
import messageRouter from "./features/messages/message.routes.js";
import notificationRouter from "./features/notifications/notification.routes.js";
import searchRouter from "./features/search/search.routes.js";
import { openApiSpec } from "./config/openapi.js";

import path from "node:path";
import { notFound } from "./middleware/not-found.middleware.js";
import { errorHandler } from "./middleware/error.middleware.js";


const app = express();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number.parseInt(process.env.AUTH_RATE_LIMIT_MAX ?? "20", 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many auth requests, please try again later." },
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number.parseInt(process.env.API_RATE_LIMIT_MAX ?? "200", 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please try again later." },
});

app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(generalLimiter);
app.use("/uploads", express.static(path.resolve(process.cwd(), "public/uploads")));
app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use("/api/v1/auth", authLimiter);

app.use("/api/v1/health", healthRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/posts", postRouter);
app.use("/api/v1/comments", commentRouter);
app.use("/api/v1/posts/:postId/comments", nestedCommentRouter);
app.use("/api/v1/projects", projectRouter);
app.use("/api/v1/communities", communityRouter);
app.use("/api/v1/community-posts", communityPostRouter);
app.use("/api/v1/conversations", chatRouter);
app.use("/api/v1/messages", messageRouter);
app.use("/api/v1/notifications", notificationRouter);
app.use("/api/v1/search", searchRouter);

app.get("/api/docs.json", (_req, res) => {
  res.json(openApiSpec);
});

app.use(notFound);
app.use(errorHandler);

export default app;
import express from "express";
import cors from "cors";

import { env } from "./config/env.js";
import healthRouter from "./features/health/health.routes.js";
import userRouter from "./features/users/user.routes.js";
import postRouter from "./features/posts/post.routes.js";
import { notFound } from "./middleware/not-found.middleware.js";
import { errorHandler } from "./middleware/error.middleware.js";


const app = express();

app.disable("x-powered-by");

app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/api/v1/health", healthRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/posts", postRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
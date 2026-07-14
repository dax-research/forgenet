import { env } from "../config/env.js";

export const errorHandler = (error, _request, response, _next) => {
  const statusCode = error.statusCode ?? error.status ?? 500;

  let message = error.message;

  if (error.type === "entity.parse.failed") {
    message = "Request body contains invalid JSON.";
  } else if (statusCode >= 500) {
    message = "Internal server error.";
  }

  console.error(error);

  return response.status(statusCode).json({
    success: false,
    message,
    ...(env.nodeEnv === "development" && { stack: error.stack }),
  });
};
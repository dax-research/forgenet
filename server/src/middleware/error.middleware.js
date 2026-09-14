import { env } from "../config/env.js";

export const errorHandler = (error, _request, response, _next) => {
  let statusCode = error.statusCode ?? error.status ?? 500;
  let message = error.message;

  if (error.name === "CastError" && error.kind === "ObjectId") {
    statusCode = 400;
    message = "Invalid ID format";
  } else if (error.name === "ValidationError") {
    statusCode = 400;
    message = error.message;
  } else if (error.code === 11000) {
    statusCode = 409;
    message = "Duplicate field value entered";
  } else if (error.type === "entity.parse.failed") {
    statusCode = 400;
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
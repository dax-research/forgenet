import { createServer } from "node:http";

import app from "./app.js";
import {
  connectDatabase,
  disconnectDatabase,
} from "./config/database.js";
import { env } from "./config/env.js";

const httpServer = createServer(app);

const startServer = async () => {
  try {
    await connectDatabase();

    httpServer.listen(env.port, () => {
      console.log(
        `ForgeNet API running at http://localhost:${env.port}`
      );
    });
  } catch (error) {
    console.error("ForgeNet server failed to start:", error.message);
    process.exit(1);
  }
};

httpServer.on("error", async (error) => {
  console.error("HTTP server error:", error.message);

  try {
    await disconnectDatabase();
  } catch (disconnectError) {
    console.error(
      "Failed to disconnect MongoDB:",
      disconnectError.message
    );
  }

  process.exit(1);
});

let isShuttingDown = false;

const shutdown = (signal) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`${signal} received. Closing the server...`);

  httpServer.close(async (serverError) => {
    let exitCode = serverError ? 1 : 0;

    if (serverError) {
      console.error(
        "Failed to close the HTTP server:",
        serverError.message
      );
    }

    try {
      await disconnectDatabase();
    } catch (databaseError) {
      exitCode = 1;
      console.error(
        "Failed to disconnect MongoDB:",
        databaseError.message
      );
    }

    console.log("Server shutdown complete.");
    process.exit(exitCode);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

startServer();
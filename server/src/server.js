import { createServer } from "node:http";

import app from "./app.js";
import { env } from "./config/env.js";

const httpServer = createServer(app);

httpServer.listen(env.port, () => {
  console.log(`ForgeNet API running at http://localhost:${env.port}`);
});

httpServer.on("error", (error) => {
  console.error("Failed to start the server:", error);
  process.exit(1);
});

const shutdown = (signal) => {
  console.log(`${signal} received. Closing the server...`);

  httpServer.close((error) => {
    if (error) {
      console.error("Failed to close the server:", error);
      process.exit(1);
    }

    console.log("Server closed successfully.");
    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
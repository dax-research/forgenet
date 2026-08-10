import mongoose from "mongoose";
import dns from "dns";

import { env } from "./env.js";

// Use reliable public DNS servers when the system resolver refuses SRV queries.
// This is a fallback for local/dev machines with DNS restrictions.
try {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
} catch (err) {
  console.warn("Unable to set DNS servers for MongoDB SRV lookup:", err.message);
}

export const connectDatabase = async () => {
  const connection = await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 10000,
  });

  console.log(
    `MongoDB connected to database: ${connection.connection.name}`
  );
};

export const disconnectDatabase = async () => {
  if (mongoose.connection.readyState === 0) {
    return;
  }

  await mongoose.disconnect();
  console.log("MongoDB disconnected.");
};
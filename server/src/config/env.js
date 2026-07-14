import "dotenv/config";

const parsePort = (value) => {
  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  return port;
};

const nodeEnv = process.env.NODE_ENV ?? "development";
const allowedEnvironments = ["development", "test", "production"];

if (!allowedEnvironments.includes(nodeEnv)) {
  throw new Error(
    `NODE_ENV must be one of: ${allowedEnvironments.join(", ")}.`
  );
}

export const env = Object.freeze({
  port: parsePort(process.env.PORT ?? "5000"),
  nodeEnv,
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:5173",
});
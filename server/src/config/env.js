import "dotenv/config";

const getRequiredValue = (name) => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
};

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

const mongoUri =
  process.env.MONGODB_URI?.trim() ??
  (nodeEnv === "development"
    ? "mongodb://127.0.0.1:27017/forgenet"
    : undefined);

if (!mongoUri) {
  throw new Error(
    "MONGODB_URI is required. Set it in .env for production or define it locally."
  );
}

if (
  !mongoUri.startsWith("mongodb://") &&
  !mongoUri.startsWith("mongodb+srv://")
) {
  throw new Error(
    "MONGODB_URI must start with mongodb:// or mongodb+srv://."
  );
}

export const env = Object.freeze({
  port: parsePort(process.env.PORT ?? "5000"),
  nodeEnv,
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:5173",
  mongoUri,
});
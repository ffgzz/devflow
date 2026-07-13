import mongoose from "mongoose";
import {
  loadProjectEnv,
  requireEnv,
  safeErrorMessage,
} from "./_env.mjs";

const DATABASE_NAME = "devflow";
const MAX_ATTEMPTS = 5;

loadProjectEnv();

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function checkMongoDB() {
  const uri = requireEnv("MONGODB_URI");
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await mongoose.connect(uri, {
        dbName: DATABASE_NAME,
        serverSelectionTimeoutMS: 5_000,
      });

      const database = mongoose.connection.db;
      if (!database) {
        throw new Error("MongoDB connected without an active database handle.");
      }

      await database.admin().ping();
      process.stdout.write(
        `Health check passed: MongoDB database "${DATABASE_NAME}" is reachable.\n`,
      );
      return;
    } catch (error) {
      lastError = error;
      await mongoose.disconnect().catch(() => undefined);

      if (attempt < MAX_ATTEMPTS) {
        await wait(attempt * 500);
      }
    }
  }

  throw lastError;
}

try {
  await checkMongoDB();
} catch (error) {
  process.stderr.write(`Health check failed: ${safeErrorMessage(error)}\n`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => undefined);
}

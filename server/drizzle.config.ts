import { defineConfig } from "drizzle-kit";
import { resolve } from "node:path";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: resolve(import.meta.dir, "..", "data", "talkto.db"),
  },
});

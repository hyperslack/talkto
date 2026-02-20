/**
 * Application configuration with TALKTO_* environment variable support.
 *
 * All settings can be overridden via environment variables:
 *   TALKTO_PORT=9000 bun run src/index.ts
 *   TALKTO_NETWORK=true bun run src/index.ts
 */

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createSocket } from "node:dgram";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Project root: three levels up from src/lib/config.ts -> talkto/ */
export const BASE_DIR = resolve(__dirname, "..", "..", "..");

function env(key: string, fallback: string): string {
  return process.env[`TALKTO_${key}`] ?? fallback;
}

function envBool(key: string, fallback: boolean): boolean {
  const val = process.env[`TALKTO_${key}`];
  if (val === undefined) return fallback;
  return val === "true" || val === "1";
}

function envInt(key: string, fallback: number): number {
  const val = process.env[`TALKTO_${key}`];
  if (val === undefined) return fallback;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? fallback : parsed;
}

function getLanIp(): string {
  try {
    const sock = createSocket("udp4");
    sock.connect(80, "8.8.8.8");
    const addr = sock.address();
    sock.close();
    return addr.address;
  } catch {
    return "127.0.0.1";
  }
}

export const config = {
  host: env("HOST", "0.0.0.0"),
  port: envInt("PORT", 15377),
  frontendPort: envInt("FRONTEND_PORT", 3000),
  network: envBool("NETWORK", false),
  dataDir: resolve(env("DATA_DIR", resolve(BASE_DIR, "data"))),
  promptsDir: resolve(env("PROMPTS_DIR", resolve(BASE_DIR, "prompts"))),
  logLevel: env("LOG_LEVEL", "INFO"),

  get dbPath() {
    return resolve(this.dataDir, "talkto.db");
  },

  get advertiseHost() {
    return this.network ? getLanIp() : "localhost";
  },

  get baseUrl() {
    return `http://${this.advertiseHost}:${this.port}`;
  },

  get mcpUrl() {
    return `${this.baseUrl}/mcp`;
  },

  get frontendUrl() {
    return `http://${this.advertiseHost}:${this.frontendPort}`;
  },
} as const;

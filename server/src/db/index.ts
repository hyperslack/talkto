/**
 * Database connection — bun:sqlite with WAL mode + Drizzle ORM.
 */

import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "../lib/config";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sqlite: Database | null = null;

export function getDb() {
  if (_db) return _db;

  // Ensure data directory exists
  mkdirSync(dirname(config.dbPath), { recursive: true });

  _sqlite = new Database(config.dbPath);

  // SQLite pragmas — matching the Python backend
  _sqlite.exec("PRAGMA journal_mode = WAL");
  _sqlite.exec("PRAGMA foreign_keys = ON");
  _sqlite.exec("PRAGMA busy_timeout = 5000");
  _sqlite.exec("PRAGMA synchronous = NORMAL");
  _sqlite.exec("PRAGMA cache_size = -64000");
  _sqlite.exec("PRAGMA temp_store = MEMORY");

  _db = drizzle(_sqlite, { schema });
  return _db;
}

export function closeDb() {
  if (_sqlite) {
    _sqlite.close();
    _sqlite = null;
    _db = null;
  }
}

/** Shorthand type for the database instance */
export type Db = ReturnType<typeof getDb>;

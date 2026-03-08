/**
 * Shared test environment bootstrap.
 *
 * Ensures server integration tests never touch the real product database.
 * This module must be imported before any ../src/* modules that read config.
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

if (!process.env.TALKTO_DATA_DIR) {
  process.env.TALKTO_DATA_DIR = mkdtempSync(join(tmpdir(), "talkto-tests-"));
}

if (!process.env.TALKTO_DISABLE_SERVER) {
  process.env.TALKTO_DISABLE_SERVER = "1";
}

if (!process.env.TALKTO_SKIP_REGISTRATION_VERIFY) {
  process.env.TALKTO_SKIP_REGISTRATION_VERIFY = "1";
}

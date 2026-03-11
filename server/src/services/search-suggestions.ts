/**
 * Search suggestions — recent and popular search terms.
 *
 * Tracks search history per user for autocomplete suggestions.
 */

import { getDb } from "../db";
import { sql } from "drizzle-orm";

export interface SearchSuggestion {
  query: string;
  search_count: number;
  last_searched_at: string;
}

/** Ensure the search_history table exists. */
export function ensureSearchHistoryTable(): void {
  const db = getDb();
  db.run(sql`CREATE TABLE IF NOT EXISTS search_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    query TEXT NOT NULL,
    searched_at TEXT NOT NULL
  )`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id, workspace_id)`);
}

/** Record a search query. */
export function recordSearch(userId: string, workspaceId: string, query: string): void {
  const db = getDb();
  ensureSearchHistoryTable();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.run(sql`INSERT INTO search_history (id, user_id, workspace_id, query, searched_at)
    VALUES (${id}, ${userId}, ${workspaceId}, ${query}, ${now})`);
}

/** Get recent search suggestions for a user. */
export function getRecentSearches(userId: string, workspaceId: string, limit: number = 10): SearchSuggestion[] {
  const db = getDb();
  ensureSearchHistoryTable();
  return db.all(sql`
    SELECT query, COUNT(*) as search_count, MAX(searched_at) as last_searched_at
    FROM search_history
    WHERE user_id = ${userId} AND workspace_id = ${workspaceId}
    GROUP BY query
    ORDER BY last_searched_at DESC
    LIMIT ${limit}
  `) as SearchSuggestion[];
}

/** Get popular searches across a workspace. */
export function getPopularSearches(workspaceId: string, limit: number = 10): SearchSuggestion[] {
  const db = getDb();
  ensureSearchHistoryTable();
  return db.all(sql`
    SELECT query, COUNT(*) as search_count, MAX(searched_at) as last_searched_at
    FROM search_history
    WHERE workspace_id = ${workspaceId}
    GROUP BY query
    ORDER BY search_count DESC
    LIMIT ${limit}
  `) as SearchSuggestion[];
}

/** Clear search history for a user. */
export function clearSearchHistory(userId: string, workspaceId: string): number {
  const db = getDb();
  ensureSearchHistoryTable();
  const result = db.run(sql`DELETE FROM search_history
    WHERE user_id = ${userId} AND workspace_id = ${workspaceId}`);
  return (result as unknown as { changes: number }).changes;
}

/**
 * WebSocket connection manager — tracks clients with channel subscriptions.
 *
 * Supports targeted message delivery: new_message events are only sent to
 * clients subscribed to that channel. All other events broadcast to everyone.
 * Supports workspace scoping: when a workspaceId is provided to broadcast(),
 * only clients in that workspace receive the event.
 */

import type { ServerWebSocket } from "bun";

export interface WsData {
  id: number;
  workspaceId: string;
}

interface WsClient {
  ws: ServerWebSocket<WsData>;
  workspaceId: string;
  subscribedChannels: Set<string>;
}

let nextId = 1;
const clients = new Map<number, WsClient>();

export function acceptClient(ws: ServerWebSocket<WsData>): number {
  const id = nextId++;
  ws.data = { ...ws.data, id };
  clients.set(id, {
    ws,
    workspaceId: ws.data.workspaceId,
    subscribedChannels: new Set(),
  });
  console.log(`[WS] Client connected: ${id} (workspace: ${ws.data.workspaceId})`);
  return id;
}

export function disconnectClient(ws: ServerWebSocket<WsData>): void {
  const id = ws.data?.id;
  if (id !== undefined) {
    clients.delete(id);
    console.log(`[WS] Client disconnected: ${id}`);
  }
}

export function subscribe(ws: ServerWebSocket<WsData>, channelIds: string[]): void {
  const id = ws.data?.id;
  if (id === undefined) return;
  const client = clients.get(id);
  if (client) {
    for (const ch of channelIds) {
      client.subscribedChannels.add(ch);
    }
  }
}

export function unsubscribe(ws: ServerWebSocket<WsData>, channelIds: string[]): void {
  const id = ws.data?.id;
  if (id === undefined) return;
  const client = clients.get(id);
  if (client) {
    for (const ch of channelIds) {
      client.subscribedChannels.delete(ch);
    }
  }
}

export function getClientCount(): number {
  return clients.size;
}

/**
 * Broadcast a JSON event to clients subscribed to a specific channel.
 * Optionally exclude a sender (by client id) to avoid echo.
 */
export function broadcastToChannel(
  channelId: string,
  event: Record<string, unknown>,
  excludeClientId?: number
): void {
  const payload = JSON.stringify(event);
  const dead: number[] = [];

  for (const [id, client] of clients) {
    if (id === excludeClientId) continue;
    if (!client.subscribedChannels.has(channelId)) continue;
    try {
      client.ws.send(payload);
    } catch {
      dead.push(id);
    }
  }

  for (const id of dead) {
    clients.delete(id);
  }
}

/**
 * Broadcast a JSON event to connected clients.
 *
 * For `new_message` events, only sends to clients subscribed to that channel.
 * For all other events (agent_status, feature_update, etc.), sends to everyone.
 *
 * When `workspaceId` is provided, only sends to clients in that workspace.
 * When `workspaceId` is null/undefined, broadcasts to all clients (global events).
 */
export function broadcast(event: Record<string, unknown>, workspaceId?: string | null): void {
  const payload = JSON.stringify(event);
  const eventType = event.type as string | undefined;
  const dead: number[] = [];

  for (const [id, client] of clients) {
    // Workspace filter: if workspaceId provided, skip clients not in that workspace
    if (workspaceId != null && client.workspaceId !== workspaceId) {
      continue;
    }

    // For new_message events, filter by channel subscription
    if (eventType === "new_message") {
      const data = event.data as Record<string, unknown> | undefined;
      const channelId = data?.channel_id as string | undefined;
      if (
        client.subscribedChannels.size > 0 &&
        channelId &&
        !client.subscribedChannels.has(channelId)
      ) {
        continue;
      }
    }

    try {
      client.ws.send(payload);
    } catch {
      dead.push(id);
    }
  }

  // Clean up dead connections
  for (const id of dead) {
    clients.delete(id);
  }
}

/** Connection status utilities for the WebSocket indicator. */

export type ConnectionState = "connected" | "connecting" | "disconnected";

export interface ConnectionStatusInfo {
  state: ConnectionState;
  label: string;
  color: "green" | "yellow" | "red";
}

export function getConnectionStatus(
  wsConnected: boolean,
  isReconnecting?: boolean,
): ConnectionStatusInfo {
  if (wsConnected) {
    return { state: "connected", label: "Connected", color: "green" };
  }
  if (isReconnecting) {
    return { state: "connecting", label: "Reconnecting…", color: "yellow" };
  }
  return { state: "disconnected", label: "Disconnected", color: "red" };
}

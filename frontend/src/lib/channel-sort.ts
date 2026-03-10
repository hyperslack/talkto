/** Channel sorting utilities. */
import type { Channel } from "./types";

export type ChannelSortMode = "name" | "created" | "type";

export function sortChannels(channels: Channel[], mode: ChannelSortMode): Channel[] {
  const sorted = [...channels];
  switch (mode) {
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "created":
      return sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    case "type":
      return sorted.sort((a, b) => {
        const typeOrder = (t: string) => {
          switch (t) {
            case "general": return 0;
            case "project": return 1;
            case "custom": return 2;
            case "dm": return 3;
            default: return 4;
          }
        };
        const diff = typeOrder(a.type) - typeOrder(b.type);
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      });
    default:
      return sorted;
  }
}

/** Global application store using Zustand.
 *
 * Manages UI state, active channel, and real-time data that comes via WebSocket.
 * API-fetched data (channels, agents, messages) lives in TanStack Query cache.
 * This store holds ephemeral UI state and WebSocket-pushed updates.
 */
import { create } from "zustand";
import type { AuthInfo, Message, UiNotice, Workspace } from "@/lib/types";

function readStarredChannels(): Set<string> {
  try {
    const raw = localStorage.getItem("talkto-starred-channels");
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function writeStarredChannels(ids: Set<string>): void {
  try {
    localStorage.setItem("talkto-starred-channels", JSON.stringify([...ids]));
  } catch {
    // Storage unavailable
  }
}

function readDarkMode(): boolean {
  try {
    return localStorage.getItem("talkto-dark-mode") === "true";
  } catch {
    return false;
  }
}

function writeDarkMode(value: boolean): void {
  try {
    localStorage.setItem("talkto-dark-mode", String(value));
  } catch {
    // Storage unavailable
  }
}

function applyDarkClass(dark: boolean): void {
  try {
    document.documentElement.classList.toggle("dark", dark);
  } catch {
    // DOM unavailable
  }
}

interface AppState {
  isOnboarded: boolean;
  setOnboarded: (v: boolean) => void;

  activeChannelId: string | null;
  setActiveChannelId: (id: string | null) => void;

  sidebarOpen: boolean;
  toggleSidebar: () => void;

  realtimeMessages: Message[];
  addRealtimeMessage: (msg: Message) => void;
  removeRealtimeMessage: (msgId: string) => void;

  agentStatuses: Map<string, "online" | "offline">;
  setAgentStatus: (name: string, status: "online" | "offline") => void;

  typingAgents: Map<string, Set<string>>;
  setAgentTyping: (
    channelId: string,
    agentName: string,
    isTyping: boolean,
    error?: string,
  ) => void;

  streamingMessages: Map<string, Map<string, string>>;
  appendStreamingDelta: (channelId: string, agentName: string, delta: string) => void;
  clearStreamingMessage: (channelId: string, agentName: string) => void;
  clearAgentPresence: (agentName: string) => void;

  replyToMessage: Message | null;
  setReplyToMessage: (msg: Message | null) => void;

  invocationError: { channelId: string; message: string } | null;
  clearInvocationError: () => void;

  notices: UiNotice[];
  showNotice: (notice: Omit<UiNotice, "id"> & { id?: string }) => string;
  dismissNotice: (noticeId: string) => void;

  starredChannels: Set<string>;
  toggleStarredChannel: (channelId: string) => void;

  darkMode: boolean;
  toggleDarkMode: () => void;

  wsConnected: boolean;
  setWsConnected: (v: boolean) => void;

  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string | null) => void;
  workspaces: Workspace[];
  setWorkspaces: (ws: Workspace[]) => void;
  authInfo: AuthInfo | null;
  setAuthInfo: (info: AuthInfo | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isOnboarded: false,
  setOnboarded: (v) => set({ isOnboarded: v }),

  activeChannelId: null,
  setActiveChannelId: (id) =>
    set({ activeChannelId: id, realtimeMessages: [], replyToMessage: null }),

  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  realtimeMessages: [],
  addRealtimeMessage: (msg) =>
    set((s) => {
      const next = [...s.realtimeMessages, msg];
      return { realtimeMessages: next.length > 200 ? next.slice(-200) : next };
    }),
  removeRealtimeMessage: (msgId) =>
    set((s) => ({
      realtimeMessages: s.realtimeMessages.filter((m) => m.id !== msgId),
    })),

  agentStatuses: new Map(),
  setAgentStatus: (name, status) =>
    set((s) => {
      const next = new Map(s.agentStatuses);
      next.set(name, status);
      return { agentStatuses: next };
    }),

  typingAgents: new Map(),
  setAgentTyping: (channelId, agentName, isTyping, error?) =>
    set((s) => {
      const next = new Map(s.typingAgents);
      const agents = new Set(next.get(channelId) ?? []);
      if (isTyping) {
        agents.add(agentName);
      } else {
        agents.delete(agentName);
      }
      if (agents.size === 0) {
        next.delete(channelId);
      } else {
        next.set(channelId, agents);
      }
      return {
        typingAgents: next,
        invocationError: error ? { channelId, message: error } : s.invocationError,
      };
    }),

  streamingMessages: new Map(),
  appendStreamingDelta: (channelId, agentName, delta) =>
    set((s) => {
      const next = new Map(s.streamingMessages);
      const channelStreams = new Map(next.get(channelId) ?? []);
      const current = channelStreams.get(agentName) ?? "";
      channelStreams.set(agentName, current + delta);
      next.set(channelId, channelStreams);
      return { streamingMessages: next };
    }),
  clearStreamingMessage: (channelId, agentName) =>
    set((s) => {
      const next = new Map(s.streamingMessages);
      const channelStreams = next.get(channelId);
      if (channelStreams) {
        const updated = new Map(channelStreams);
        updated.delete(agentName);
        if (updated.size === 0) {
          next.delete(channelId);
        } else {
          next.set(channelId, updated);
        }
      }
      return { streamingMessages: next };
    }),
  clearAgentPresence: (agentName) =>
    set((s) => {
      const typingAgents = new Map<string, Set<string>>();
      for (const [channelId, agents] of s.typingAgents.entries()) {
        const filtered = new Set(Array.from(agents).filter((name) => name !== agentName));
        if (filtered.size > 0) {
          typingAgents.set(channelId, filtered);
        }
      }

      const streamingMessages = new Map<string, Map<string, string>>();
      for (const [channelId, streams] of s.streamingMessages.entries()) {
        const filtered = new Map(streams);
        filtered.delete(agentName);
        if (filtered.size > 0) {
          streamingMessages.set(channelId, filtered);
        }
      }

      return { typingAgents, streamingMessages };
    }),

  invocationError: null,
  replyToMessage: null,
  setReplyToMessage: (msg) => set({ replyToMessage: msg }),
  clearInvocationError: () => set({ invocationError: null }),

  notices: [],
  showNotice: (notice) => {
    const noticeId = notice.id ?? crypto.randomUUID();
    set((s) => {
      const next = notice.key
        ? s.notices.filter((entry) => entry.key !== notice.key)
        : s.notices.filter((entry) => entry.id !== noticeId);
      next.push({ ...notice, id: noticeId });
      return { notices: next.slice(-6) };
    });
    return noticeId;
  },
  dismissNotice: (noticeId) =>
    set((s) => ({
      notices: s.notices.filter((notice) => notice.id !== noticeId),
    })),

  starredChannels: readStarredChannels(),
  toggleStarredChannel: (channelId) =>
    set((s) => {
      const next = new Set(s.starredChannels);
      if (next.has(channelId)) {
        next.delete(channelId);
      } else {
        next.add(channelId);
      }
      writeStarredChannels(next);
      return { starredChannels: next };
    }),

  darkMode: readDarkMode(),
  toggleDarkMode: () =>
    set((s) => {
      const next = !s.darkMode;
      writeDarkMode(next);
      applyDarkClass(next);
      return { darkMode: next };
    }),

  wsConnected: false,
  setWsConnected: (v) => set({ wsConnected: v }),

  activeWorkspaceId: null,
  setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),
  workspaces: [],
  setWorkspaces: (ws) => set({ workspaces: ws }),
  authInfo: null,
  setAuthInfo: (info) => set({ authInfo: info }),
}));

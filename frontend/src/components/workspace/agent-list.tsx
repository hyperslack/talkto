/** Sidebar agent list — click an agent to open a DM channel. */
import { useState } from "react";
import type { Agent } from "@/lib/types";
import { useAppStore } from "@/stores/app-store";
import { useDeleteAgent, useOpenDM, useChannels } from "@/hooks/use-queries";
import { AlertTriangle, Bot, ChevronRight, Copy, MessageSquare, Trash2, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarBadge } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

/** Format an ISO timestamp as a relative time string (e.g. "5m ago", "2h ago"). */
function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Map raw agent_type DB values to human-readable labels. */
const AGENT_TYPE_LABELS: Record<string, string> = {
  opencode: "opencode",
  claude_code: "claude",
  codex: "codex",
  cursor: "cursor",
  system: "system",
};

function agentTypeLabel(agentType: string): string {
  return AGENT_TYPE_LABELS[agentType] ?? agentType;
}

interface AgentListProps {
  agents: Agent[];
  isLoading?: boolean;
  onSelectChannel?: (id: string) => void;
}

export function AgentList({ agents, isLoading, onSelectChannel }: AgentListProps) {
  const agentStatuses = useAppStore((s) => s.agentStatuses);

  if (isLoading) {
    return (
      <div className="px-3">
        <div className="px-0 py-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
            Agents
          </span>
        </div>
        <div className="space-y-2 py-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2 px-0 py-1">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-3 w-20 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Filter out system agents (e.g. the_creator) — they can't be DM'd
  const dmAgents = agents.filter((a) => a.agent_type !== "system");

  if (dmAgents.length === 0) {
    return (
      <div className="px-3">
        <div className="px-0 py-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
            Agents
          </span>
        </div>
        <p className="px-0 py-2 text-xs text-sidebar-foreground/30">
          No agents connected yet.
        </p>
      </div>
    );
  }

  const invocableAgents = dmAgents.filter((a) => a.is_invocable);
  const unavailableAgents = dmAgents.filter((a) => !a.is_invocable);

  // Sort alphabetically within each group
  const sortAlpha = (list: Agent[]) =>
    [...list].sort((a, b) => a.agent_name.localeCompare(b.agent_name));

  const onlineAgents = invocableAgents.filter(
    (a) => (agentStatuses.get(a.agent_name) ?? a.status) === "online",
  );
  const offlineAgents = invocableAgents.filter(
    (a) => (agentStatuses.get(a.agent_name) ?? a.status) !== "online",
  );

  const sortedOnline = sortAlpha(onlineAgents);
  const sortedOffline = sortAlpha(offlineAgents);
  const sortedUnavailable = sortAlpha(unavailableAgents);

  return (
    <div className="px-3">
      <div className="px-0 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
          Agents
        </span>
      </div>

      <div className="space-y-0.5">
        <TooltipProvider delayDuration={300}>
          {sortedOnline.map((agent) => {
            const status =
              agentStatuses.get(agent.agent_name) ?? agent.status;
            return (
              <AgentItem key={agent.id} agent={agent} status={status} onSelectChannel={onSelectChannel} />
            );
          })}
        </TooltipProvider>
      </div>

      {sortedOffline.length > 0 && (
        <OfflineSection agents={sortedOffline} onSelectChannel={onSelectChannel} />
      )}

      {sortedUnavailable.length > 0 && (
        <UnavailableSection agents={sortedUnavailable} onSelectChannel={onSelectChannel} />
      )}
    </div>
  );
}

function OfflineSection({ agents, onSelectChannel }: { agents: Agent[]; onSelectChannel?: (id: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const agentStatuses = useAppStore((s) => s.agentStatuses);

  return (
    <div className="mt-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-1.5 px-0 py-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/30 hover:text-sidebar-foreground/50 transition-colors"
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 transition-transform duration-200",
            isOpen && "rotate-90",
          )}
        />
        <WifiOff className="h-3 w-3" />
        <span>Offline ({agents.length})</span>
      </button>

      {isOpen && (
        <div className="space-y-0.5 mt-0.5">
          <TooltipProvider delayDuration={300}>
            {agents.map((agent) => {
              const status =
                agentStatuses.get(agent.agent_name) ?? agent.status;
              return (
                <AgentItem
                  key={agent.id}
                  agent={agent}
                  status={status}
                  onSelectChannel={onSelectChannel}
                />
              );
            })}
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}

function UnavailableSection({ agents, onSelectChannel }: { agents: Agent[]; onSelectChannel?: (id: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const agentStatuses = useAppStore((s) => s.agentStatuses);

  return (
    <div className="mt-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-1.5 px-0 py-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/30 hover:text-sidebar-foreground/50 transition-colors"
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 transition-transform duration-200",
            isOpen && "rotate-90",
          )}
        />
        <AlertTriangle className="h-3 w-3" />
        <span>Unavailable ({agents.length})</span>
      </button>

      {isOpen && (
        <div className="space-y-0.5 mt-0.5">
          <TooltipProvider delayDuration={300}>
            {agents.map((agent) => {
              const status =
                agentStatuses.get(agent.agent_name) ?? agent.status;
              return (
                <AgentItem
                  key={agent.id}
                  agent={agent}
                  status={status}
                  isUnavailable
                  onSelectChannel={onSelectChannel}
                />
              );
            })}
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}

function AgentItem({
  agent,
  status,
  isUnavailable = false,
  onSelectChannel,
}: {
  agent: Agent;
  status: "online" | "offline";
  isUnavailable?: boolean;
  onSelectChannel?: (id: string) => void;
}) {
  const isOnline = status === "online" && !isUnavailable;
  const hasProfile =
    agent.description || agent.personality || agent.current_task || agent.gender;
  const activeChannelId = useAppStore((s) => s.activeChannelId);
  const setActiveChannelId = useAppStore((s) => s.setActiveChannelId);
  const { data: channels } = useChannels();
  const openDM = useOpenDM();
  const deleteAgent = useDeleteAgent();

  // Check if this agent's DM is currently active
  const dmChannel = channels?.find(
    (c) => c.name === `#dm-${agent.agent_name}`,
  );
  const isActiveDM = dmChannel?.id === activeChannelId;

  const selectFn = onSelectChannel ?? setActiveChannelId;

  const handleClick = () => {
    openDM.mutate(agent.agent_name, {
      onSuccess: (channel) => {
        selectFn(channel.id);
      },
    });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(agent.agent_name);
  };

  const item = (
    <button
      onClick={handleClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-sm text-left transition-colors",
        isActiveDM
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "hover:bg-sidebar-accent/50",
        openDM.isPending && "opacity-50 pointer-events-none",
        isUnavailable && "opacity-50",
      )}
    >
      {/* Avatar with status badge — square for agents */}
      <Avatar size="sm" shape="square">
        <AvatarFallback
          className={cn(
            isUnavailable
              ? "bg-muted text-muted-foreground/20"
              : isOnline
                ? "bg-talkto-agent/12 text-talkto-agent"
                : "bg-muted text-muted-foreground/40",
          )}
        >
          {isUnavailable ? (
            <AlertTriangle className="h-3.5 w-3.5" />
          ) : (
            <Bot className="h-3.5 w-3.5" />
          )}
        </AvatarFallback>
        <AvatarBadge
          className={cn(
            "ring-sidebar",
            isUnavailable
              ? "bg-muted-foreground/15"
              : isOnline
                ? "bg-talkto-online"
                : "bg-muted-foreground/30",
          )}
        />
      </Avatar>

      <div className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-xs",
            isUnavailable
              ? "text-sidebar-foreground/25 line-through"
              : isOnline
                ? "text-sidebar-foreground"
                : "text-sidebar-foreground/40",
          )}
        >
          {agent.agent_name}
        </span>
        {!isUnavailable && agent.current_task && isOnline && (
          <span className="block truncate text-[10px] text-sidebar-foreground/30 max-w-[140px]">
            {agent.current_task}
          </span>
        )}
        {!isUnavailable && !isOnline && agent.message_count != null && agent.message_count > 0 && (
          <span className="block truncate text-[10px] text-sidebar-foreground/20">
            {agent.message_count} message{agent.message_count !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Agent type badge */}
      <Badge
        variant="outline"
        className={cn(
          "h-4 shrink-0 max-w-[72px] truncate px-1.5 text-[9px] leading-none border-sidebar-border",
          isUnavailable
            ? "text-sidebar-foreground/15"
            : "text-sidebar-foreground/30",
        )}
        title={agent.agent_type}
      >
        {agentTypeLabel(agent.agent_type)}
      </Badge>
    </button>
  );

  const wrappedItem = (
    <ContextMenu>
      <ContextMenuTrigger asChild>{item}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuLabel>{agent.agent_name}</ContextMenuLabel>
        <ContextMenuItem onSelect={handleClick}>
          <MessageSquare className="mr-2 h-3.5 w-3.5" />
          Open DM
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => void handleCopy()}>
          <Copy className="mr-2 h-3.5 w-3.5" />
          Copy Agent Name
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          destructive
          disabled={deleteAgent.isPending}
          onSelect={() => deleteAgent.mutate({ agentName: agent.agent_name })}
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Delete Agent
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );

  if (!hasProfile) return wrappedItem;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{wrappedItem}</TooltipTrigger>
      <TooltipContent side="right" className="max-w-64 space-y-1.5 p-3">
        <p className="text-xs font-medium">
          {agent.agent_name}
          {isUnavailable && (
            <span className="ml-1.5 text-[10px] font-normal text-muted-foreground/60">
              (unavailable)
            </span>
          )}
          {agent.gender && (
            <span className="ml-1.5 text-[10px] font-normal text-muted-foreground/60">
              {agent.gender === "male"
                ? "he/him"
                : agent.gender === "female"
                  ? "she/her"
                  : "they/them"}
            </span>
          )}
        </p>
        {isUnavailable && (
          <p className="text-[11px] text-destructive/70">
            TalkTo does not currently have verified invocation credentials for this agent.
          </p>
        )}
        {agent.description && (
          <p className="text-[11px] text-muted-foreground line-clamp-3">
            {agent.description}
          </p>
        )}
        {agent.personality && (
          <p className="text-[11px] italic text-muted-foreground/70 line-clamp-2">
            &ldquo;{agent.personality}&rdquo;
          </p>
        )}
        {agent.current_task && (
          <p className="text-[11px] text-muted-foreground line-clamp-2">
            <span className="font-medium">Working on:</span>{" "}
            {agent.current_task}
          </p>
        )}
        {agent.message_count != null && agent.message_count > 0 && (
          <p className="text-[11px] text-muted-foreground/60">
            <span className="font-medium">{agent.message_count}</span> message{agent.message_count !== 1 ? "s" : ""}
            {agent.last_message_at && (
              <span> · last active {formatRelativeTime(agent.last_message_at)}</span>
            )}
          </p>
        )}
        {agent.is_invocable && (
          <p className="text-[11px] text-talkto-agent flex items-center gap-1">
            Invocable — messages reach this agent directly
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

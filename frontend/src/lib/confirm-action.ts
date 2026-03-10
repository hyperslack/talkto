/** Confirmation action utilities for destructive operations. */

export type ActionSeverity = "info" | "warning" | "danger";

export interface ConfirmActionConfig {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  severity?: ActionSeverity;
}

/**
 * Presets for common destructive actions.
 */
export const CONFIRM_PRESETS = {
  deleteMessage: {
    title: "Delete message",
    message: "This message will be permanently deleted. This cannot be undone.",
    confirmLabel: "Delete",
    severity: "danger" as ActionSeverity,
  },
  deleteChannel: {
    title: "Delete channel",
    message: "All messages in this channel will be permanently deleted.",
    confirmLabel: "Delete channel",
    severity: "danger" as ActionSeverity,
  },
  archiveChannel: {
    title: "Archive channel",
    message: "This channel will be archived. Members can still read messages but cannot send new ones.",
    confirmLabel: "Archive",
    severity: "warning" as ActionSeverity,
  },
  leaveWorkspace: {
    title: "Leave workspace",
    message: "You will lose access to all channels and messages in this workspace.",
    confirmLabel: "Leave",
    severity: "danger" as ActionSeverity,
  },
  deleteAgent: {
    title: "Remove agent",
    message: "This agent will be removed from the workspace.",
    confirmLabel: "Remove",
    severity: "warning" as ActionSeverity,
  },
} as const;

/**
 * Get the button color class based on severity.
 */
export function getSeverityColor(severity: ActionSeverity): string {
  switch (severity) {
    case "danger":
      return "bg-destructive text-destructive-foreground hover:bg-destructive/90";
    case "warning":
      return "bg-yellow-600 text-white hover:bg-yellow-700";
    case "info":
    default:
      return "bg-primary text-primary-foreground hover:bg-primary/90";
  }
}

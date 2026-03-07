import { useEffect } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, Info, WifiOff, X } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";

const NOTICE_STYLES = {
  error: {
    icon: AlertTriangle,
    className: "border-destructive/25 bg-destructive/8 text-foreground",
    iconClassName: "text-destructive",
  },
  warning: {
    icon: AlertTriangle,
    className: "border-amber-500/25 bg-amber-500/10 text-foreground",
    iconClassName: "text-amber-600 dark:text-amber-400",
  },
  info: {
    icon: Info,
    className: "border-border bg-background/95 text-foreground",
    iconClassName: "text-muted-foreground",
  },
} as const;

export function ErrorNoticeStack() {
  const notices = useAppStore((s) => s.notices);
  const dismissNotice = useAppStore((s) => s.dismissNotice);

  if (notices.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
      {notices.map((notice) => (
        <NoticeCard key={notice.id} noticeId={notice.id} onDismiss={dismissNotice}>
          <NoticeContent
            kind={notice.kind}
            title={notice.title}
            message={notice.message}
            onDismiss={() => dismissNotice(notice.id)}
          />
        </NoticeCard>
      ))}
    </div>
  );
}

function NoticeCard({
  noticeId,
  onDismiss,
  children,
}: {
  noticeId: string;
  onDismiss: (noticeId: string) => void;
  children: ReactNode;
}) {
  const notice = useAppStore((s) => s.notices.find((entry) => entry.id === noticeId) ?? null);

  useEffect(() => {
    if (!notice?.dismissAfterMs) return;
    const timer = window.setTimeout(() => onDismiss(noticeId), notice.dismissAfterMs);
    return () => window.clearTimeout(timer);
  }, [notice?.dismissAfterMs, noticeId, onDismiss]);

  if (!notice) return null;
  return children;
}

function NoticeContent({
  kind,
  title,
  message,
  onDismiss,
}: {
  kind: "error" | "warning" | "info";
  title: string;
  message: string;
  onDismiss: () => void;
}) {
  const style = NOTICE_STYLES[kind];
  const Icon = title.toLowerCase().includes("connection") ? WifiOff : style.icon;

  return (
    <div
      className={cn(
        "pointer-events-auto rounded-xl border px-3 py-3 shadow-lg backdrop-blur-sm",
        style.className,
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", style.iconClassName)} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded p-1 text-muted-foreground/70 transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
          aria-label="Dismiss notice"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

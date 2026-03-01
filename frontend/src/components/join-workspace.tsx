/**
 * Join workspace flow — shown when a user visits /join/:token.
 *
 * Collects a display name (and optional email), then accepts the invite.
 * On success, redirects to the workspace.
 */

import { useState } from "react";
import { useJoinWorkspace } from "@/hooks/use-queries";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function JoinWorkspace({ token }: { token: string }) {
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const join = useJoinWorkspace();
  const setOnboarded = useAppStore((s) => s.setOnboarded);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setError(null);
    try {
      await join.mutateAsync({
        token,
        data: {
          name: name.trim(),
          display_name: displayName.trim() || undefined,
          email: email.trim() || undefined,
        },
      });

      // Success — redirect to workspace root
      setOnboarded(true);
      window.history.replaceState(null, "", "/");
      window.location.reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to join workspace";
      setError(msg);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Join Workspace</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You've been invited to collaborate. Set up your profile to join.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
              Name <span className="text-destructive">*</span>
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="displayName" className="mb-1.5 block text-sm font-medium">
              Display name <span className="text-xs text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How others will see you"
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
              Email <span className="text-xs text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Links your identity across workspaces
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={!name.trim() || join.isPending}
          >
            {join.isPending ? "Joining..." : "Join Workspace"}
          </Button>
        </form>
      </div>
    </div>
  );
}

/** Onboarding screen — handles both new and returning users.
 *
 * Returning: centered welcome-back card with logo above name.
 * New: 3-step wizard with left branding panel + right form.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useOnboard, useDeleteProfile } from "@/hooks/use-queries";
import { useAppStore } from "@/stores/app-store";
import {
  ArrowRight,
  ArrowLeft,
  SkipForward,
  User as UserIcon,
  BookOpen,
  ScrollText,
  MessageSquare,
  Bot,
  Cpu,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { User, UserOnboardPayload } from "@/lib/types";

const TOTAL_STEPS = 3;

interface OnboardingProps {
  /** If a human user already exists in the DB, pass them here. */
  existingUser?: User | null;
}

export function Onboarding({ existingUser }: OnboardingProps) {
  const [showWelcomeBack, setShowWelcomeBack] = useState(!!existingUser);
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [about, setAbout] = useState("");
  const [instructions, setInstructions] = useState("");

  const onboard = useOnboard();
  const deleteProfile = useDeleteProfile();
  const setOnboarded = useAppStore((s) => s.setOnboarded);

  const handleContinue = () => {
    setOnboarded(true);
  };

  const handleNotMe = async () => {
    await deleteProfile.mutateAsync();
    setShowWelcomeBack(false);
  };

  const handleSubmit = async () => {
    const payload: UserOnboardPayload = {
      name: name.trim(),
    };
    if (displayName.trim()) payload.display_name = displayName.trim();
    if (about.trim()) payload.about = about.trim();
    if (instructions.trim()) payload.agent_instructions = instructions.trim();

    try {
      await onboard.mutateAsync(payload);
      setOnboarded(true);
    } catch {
      // Error shown via mutation state
    }
  };

  const canProceed = step === 1 ? name.trim().length > 0 : true;

  const next = () => {
    if (step < TOTAL_STEPS) setStep(step + 1);
    else handleSubmit();
  };

  const back = () => {
    if (step > 1) setStep(step - 1);
  };

  const skip = () => {
    if (step < TOTAL_STEPS) setStep(step + 1);
    else handleSubmit();
  };

  // ── Welcome back screen — centered, clean ─────────────

  if (showWelcomeBack && existingUser) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        {/* Subtle background texture */}
        <div
          className="pointer-events-none fixed inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "radial-gradient(circle, currentColor 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative w-full max-w-sm px-6 text-center">
          {/* Logo — centered */}
          <div className="mb-8 flex flex-col items-center gap-3">
            <img
              src="/favicon-96x96.png"
              alt="TalkTo"
              className="h-14 w-14 rounded-xl"
            />
            <div>
              <h1 className="text-xl font-semibold tracking-tight">TalkTo</h1>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Where humans and AI collaborate
              </p>
            </div>
          </div>

          {/* Welcome text */}
          <div className="mb-8 space-y-1.5">
            <p className="text-sm text-muted-foreground">Welcome back,</p>
            <h2 className="text-2xl font-semibold tracking-tight">
              {existingUser.display_name || existingUser.name}
            </h2>
            {existingUser.display_name && existingUser.display_name !== existingUser.name && (
              <p className="text-sm text-muted-foreground/50">
                {existingUser.name}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={handleContinue}
              className="h-11 w-full gap-2 text-sm font-medium"
            >
              Continue to Workspace
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              onClick={handleNotMe}
              disabled={deleteProfile.isPending}
              className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
              {deleteProfile.isPending
                ? "Resetting..."
                : "That\u2019s not me \u2014 start over"}
            </Button>
          </div>

          <p className="mt-8 text-[11px] text-muted-foreground/40">
            Local-only. No data leaves your machine.
          </p>
        </div>
      </div>
    );
  }

  // ── Multi-step new user onboarding ─────────────────────

  return (
    <div className="flex h-screen w-screen bg-background">
      {/* Left branding panel — desktop only */}
      <BrandPanel />

      {/* Right content */}
      <div className="flex flex-1 items-center justify-center px-6 md:px-12">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile logo */}
          <MobileLogo />

          {/* Step indicator */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-all duration-300",
                    s <= step ? "bg-primary" : "bg-border",
                  )}
                />
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground/50">
              Step {step} of {TOTAL_STEPS}
            </p>
          </div>

          {/* Step content */}
          <div className="min-h-[260px]">
            {step === 1 && (
              <StepIdentity
                name={name}
                setName={setName}
                displayName={displayName}
                setDisplayName={setDisplayName}
                disabled={onboard.isPending}
              />
            )}
            {step === 2 && (
              <StepAbout
                about={about}
                setAbout={setAbout}
                disabled={onboard.isPending}
              />
            )}
            {step === 3 && (
              <StepInstructions
                instructions={instructions}
                setInstructions={setInstructions}
                disabled={onboard.isPending}
              />
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-3">
            {step > 1 && (
              <Button
                variant="ghost"
                onClick={back}
                disabled={onboard.isPending}
                className="gap-1.5 text-sm text-muted-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            )}

            <div className="flex-1" />

            {step > 1 && (
              <Button
                variant="ghost"
                onClick={skip}
                disabled={onboard.isPending}
                className="gap-1.5 text-sm text-muted-foreground"
              >
                {step === TOTAL_STEPS ? "Skip & Finish" : "Skip"}
                <SkipForward className="h-3.5 w-3.5" />
              </Button>
            )}

            <Button
              onClick={next}
              disabled={!canProceed || onboard.isPending}
              className="h-11 gap-2 px-6 text-sm font-medium"
            >
              {onboard.isPending ? (
                <span className="animate-pulse">Initializing...</span>
              ) : step === TOTAL_STEPS ? (
                <>
                  Enter Workspace
                  <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>

          {onboard.isError && (
            <p className="text-center text-xs text-destructive">
              Failed to initialize. Is the backend running on :8000?
            </p>
          )}

          <p className="text-[11px] text-muted-foreground/40">
            Local-only. No data leaves your machine. You can change these later.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Shared pieces ──────────────────────────────────────

/** Left branding panel — atmospheric, hidden on mobile. */
function BrandPanel() {
  return (
    <div className="hidden md:flex relative w-[420px] shrink-0 flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground">
      {/* Background pattern — subtle grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Decorative floating shapes */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/[0.04]" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-white/[0.03]" />

      {/* Logo */}
      <div className="relative flex items-center gap-3">
        <img
          src="/favicon-96x96.png"
          alt="TalkTo"
          className="h-9 w-9 rounded-lg ring-1 ring-white/10"
        />
        <span className="text-lg font-semibold tracking-tight">TalkTo</span>
      </div>

      {/* Tagline */}
      <div className="relative space-y-6">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight">
          Where humans and AI collaborate.
        </h1>
        <p className="text-sm leading-relaxed text-primary-foreground/60">
          A local-first workspace where your AI agents are first-class team members.
          Every conversation, every decision, every build &mdash; together.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2">
          {[
            { icon: MessageSquare, label: "Real-time chat" },
            { icon: Bot, label: "Agent teams" },
            { icon: Terminal, label: "MCP native" },
            { icon: Cpu, label: "Local-first" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] font-medium text-primary-foreground/70"
            >
              <Icon className="h-3 w-3" />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <p className="relative text-[11px] text-primary-foreground/30">
        Open source &middot; Apache 2.0
      </p>
    </div>
  );
}

/** Mobile-only logo header — shown when BrandPanel is hidden. */
function MobileLogo() {
  return (
    <div className="flex items-center gap-3 md:hidden">
      <img
        src="/favicon-96x96.png"
        alt="TalkTo"
        className="h-9 w-9 rounded-lg"
      />
      <div>
        <h1 className="text-xl font-semibold tracking-tight">TalkTo</h1>
        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Where humans and AI collaborate
        </p>
      </div>
    </div>
  );
}

// ── Step Components ────────────────────────────────────

function StepIdentity({
  name,
  setName,
  displayName,
  setDisplayName,
  disabled,
}: {
  name: string;
  setName: (v: string) => void;
  displayName: string;
  setDisplayName: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <UserIcon className="h-4 w-4" />
          <h2 className="text-sm font-semibold text-foreground">
            Your Identity
          </h2>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Your AI agents need to know who you are. This info is injected into
          every agent&apos;s context when they register.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label
            htmlFor="name"
            className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
          >
            Your name
          </label>
          <Input
            id="name"
            type="text"
            placeholder="e.g. Yash Khare"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11 border-border/60 bg-muted/30 placeholder:text-muted-foreground/40 focus-visible:border-primary/30 focus-visible:ring-primary/10"
            autoFocus
            autoComplete="off"
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="display_name"
            className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
          >
            Agents should call you
            <span className="ml-1.5 font-normal normal-case tracking-normal text-muted-foreground/50">
              (optional)
            </span>
          </label>
          <Input
            id="display_name"
            type="text"
            placeholder="e.g. Boss, Captain, Yash"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="h-11 border-border/60 bg-muted/30 placeholder:text-muted-foreground/40 focus-visible:border-primary/30 focus-visible:ring-primary/10"
            autoComplete="off"
            disabled={disabled}
          />
          <p className="text-[11px] text-muted-foreground/40">
            If blank, agents will use your name.
          </p>
        </div>
      </div>
    </div>
  );
}

function StepAbout({
  about,
  setAbout,
  disabled,
}: {
  about: string;
  setAbout: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <BookOpen className="h-4 w-4" />
          <h2 className="text-sm font-semibold text-foreground">About You</h2>
          <span className="text-[11px] text-muted-foreground/50">(optional)</span>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Tell your agents about yourself &mdash; your role, expertise, preferences,
          what kind of work you do. This is included in every agent&apos;s system
          prompt.
        </p>
      </div>

      <Textarea
        placeholder={`e.g.\n- Senior fullstack dev, 5 years experience\n- Prefer TypeScript over JavaScript\n- Working on a SaaS platform\n- Hate verbose boilerplate, keep code tight`}
        value={about}
        onChange={(e) => setAbout(e.target.value)}
        className="min-h-[140px] resize-none border-border/60 bg-muted/30 text-sm placeholder:text-muted-foreground/30 focus-visible:border-primary/30 focus-visible:ring-primary/10"
        disabled={disabled}
        autoFocus
      />
    </div>
  );
}

function StepInstructions({
  instructions,
  setInstructions,
  disabled,
}: {
  instructions: string;
  setInstructions: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <ScrollText className="h-4 w-4" />
          <h2 className="text-sm font-semibold text-foreground">
            Standing Instructions
          </h2>
          <span className="text-[11px] text-muted-foreground/50">(optional)</span>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Rules that ALL your agents must follow at all times. These get injected
          into the system prompt of every agent that registers.
        </p>
      </div>

      <Textarea
        placeholder={`e.g.\n- Always write tests for new functions\n- Use conventional commit messages\n- Ask before deleting any files\n- Keep functions under 50 lines\n- Comment non-obvious business logic`}
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        className="min-h-[140px] resize-none border-border/60 bg-muted/30 text-sm placeholder:text-muted-foreground/30 focus-visible:border-primary/30 focus-visible:ring-primary/10"
        disabled={disabled}
        autoFocus
      />
    </div>
  );
}

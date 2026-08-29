"use client";

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  BadgeCheck,
  Building2,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ACCOUNTS,
  DEMO_ACCOUNT,
  SSO_ORGANISATIONS,
  authenticate,
  newSessionId,
  useAuth,
  type AuthAccount,
} from "@/lib/auth";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function LoginScreen({ redirect }: { redirect?: string | undefined }) {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "verifying" | "loading">("idle");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [ssoOpen, setSsoOpen] = useState(false);

  const busy = phase !== "idle";

  async function completeSignIn(account: AuthAccount, method: "password" | "sso", organisation?: string) {
    setPhase("verifying");
    await wait(750);
    setPhase("loading");
    await wait(650);
    const { password: _pw, ...user } = account;
    signIn({
      user: { ...user, organisation: organisation ?? user.organisation },
      method,
      loginAt: new Date().toISOString(),
      sessionId: newSessionId(),
      remember,
    });
    toast.success(`Welcome back, ${user.name}`, {
      description: "National Material Master workspace is ready.",
    });
    navigate({ to: redirect && redirect.startsWith("/") && redirect !== "/login" ? redirect : "/", replace: true });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const account = authenticate(identifier, password);
    if (!account) {
      setError("Invalid user ID or password. Please verify your credentials and try again.");
      return;
    }
    await completeSignIn(account, "password");
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_minmax(420px,0.95fr)]">
      {/* Brand / institutional panel */}
      <section className="relative flex flex-col justify-between overflow-hidden bg-sidebar px-6 py-8 text-sidebar-foreground md:px-12 md:py-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.09]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="relative flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-sm bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
            NM
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">NUMM</p>
            <p className="text-[11px] leading-tight text-sidebar-foreground/65">Government of India · CPSE Programme</p>
          </div>
        </div>

        <div className="relative max-w-xl py-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/60">
            Secure enterprise portal
          </p>
          <h1 className="mt-4 text-3xl font-semibold leading-tight md:text-4xl">
            National Unified Material Master
          </h1>
          <p className="mt-3 text-2xl font-bold tracking-[0.18em] text-sidebar-primary-foreground/90">NUMM</p>
          <p className="mt-2 text-sm font-medium uppercase tracking-[0.16em] text-sidebar-foreground/70">
            One Nation • One Material Code
          </p>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-sidebar-foreground/75">
            Unified material master standardization, harmonization and governance across CPSEs.
          </p>

          <dl className="mt-10 grid max-w-lg grid-cols-2 gap-x-6 gap-y-5 border-t border-sidebar-border pt-6 sm:grid-cols-3">
            {[
              { k: "Participating CPSEs", v: "12" },
              { k: "Material records", v: "1.42 Cr" },
              { k: "National codes issued", v: "4,28,000+" },
            ].map((s) => (
              <div key={s.k}>
                <dd className="numeric text-lg font-semibold">{s.v}</dd>
                <dt className="text-[11px] uppercase tracking-wide text-sidebar-foreground/55">{s.k}</dt>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-sidebar-border pt-5 text-[11px] text-sidebar-foreground/60">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" /> NUMM-GOV-2026 governance framework
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Lock className="size-3.5" /> Access restricted to authorised personnel
          </span>
        </div>
      </section>

      {/* Credential panel */}
      <section className="flex items-center justify-center border-t border-border bg-card px-5 py-10 lg:border-l lg:border-t-0 md:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-7">
            <span className="inline-flex items-center gap-1.5 rounded-sm border border-warning/40 bg-warning/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-warning">
              Prototype environment
            </span>
            <h2 className="mt-4 text-xl font-semibold text-foreground">Sign in to your workspace</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Use your CPSE-issued work email or user ID to continue.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="identifier">Work email / User ID</Label>
              <Input
                id="identifier"
                autoComplete="username"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  setError(null);
                }}
                placeholder="Enter your work email or user ID"
                disabled={busy}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="Enter your password"
                  className="pr-10"
                  disabled={busy}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} disabled={busy} />
                Remember me
              </label>
              <button
                type="button"
                className="text-sm font-medium text-primary hover:underline"
                onClick={() => setForgotOpen(true)}
              >
                Forgot password?
              </button>
            </div>

            {error ? (
              <p
                role="alert"
                className="rounded-sm border border-critical/40 bg-critical/10 px-3 py-2 text-sm text-critical"
              >
                {error}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              {phase === "verifying"
                ? "Authenticating…"
                : phase === "loading"
                  ? "Loading NUMM workspace…"
                  : "Sign In"}
            </Button>

            {busy ? (
              <ol className="space-y-1 text-xs text-muted-foreground" aria-live="polite">
                <li className="flex items-center gap-2">
                  {phase === "verifying" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <BadgeCheck className="size-3.5 text-success" />
                  )}
                  Verifying credentials
                </li>
                <li className="flex items-center gap-2">
                  {phase === "loading" ? <Loader2 className="size-3.5 animate-spin" /> : <span className="size-3.5" />}
                  {phase === "loading" ? "Authentication successful — loading NUMM workspace" : "Loading NUMM workspace"}
                </li>
              </ol>
            ) : null}

            <div className="flex items-center gap-3 py-1">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">or</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={() => setSsoOpen(true)}
            >
              <Fingerprint className="size-4" /> Sign in with CPSE SSO
            </Button>
          </form>

          <div className="mt-6 rounded-sm border border-border bg-muted/40 px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Demo access</p>
                <p className="numeric mt-1 truncate text-xs text-muted-foreground">
                  {DEMO_ACCOUNT.email} · {DEMO_ACCOUNT.password}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 text-xs"
                disabled={busy}
                onClick={() => {
                  setIdentifier(DEMO_ACCOUNT.email);
                  setPassword(DEMO_ACCOUNT.password);
                  setError(null);
                  toast.info("Demo credentials populated");
                }}
              >
                Use demo account
              </Button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Role directory: {ACCOUNTS.map((a) => a.role).join(" · ")}. All demo accounts use the same password.
            </p>
          </div>

          <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
            Authentication is simulated for demonstration purposes. No credentials are transmitted or stored on a
            server.
          </p>
        </div>
      </section>

      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} />
      <SsoDialog
        open={ssoOpen}
        onOpenChange={setSsoOpen}
        onAuthenticated={(org) => completeSignIn(DEMO_ACCOUNT, "sso", org)}
      />
    </div>
  );
}

function ForgotPasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  function close() {
    onOpenChange(false);
    setTimeout(() => {
      setSent(false);
      setEmail("");
    }, 200);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reset your password</DialogTitle>
          <DialogDescription>
            Password resets are processed by your CPSE identity administrator.
          </DialogDescription>
        </DialogHeader>
        {sent ? (
          <p className="rounded-sm border border-success/40 bg-success/10 px-3 py-2.5 text-sm text-success">
            If an account exists for this email, password reset instructions have been sent.
          </p>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="reset-email">Work email</Label>
            <Input
              id="reset-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@cpse.gov.in"
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Back to Sign In
          </Button>
          {!sent && (
            <Button
              disabled={busy || email.trim().length < 5}
              onClick={async () => {
                setBusy(true);
                await wait(600);
                setBusy(false);
                setSent(true);
              }}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Send Reset Link
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SsoDialog({
  open,
  onOpenChange,
  onAuthenticated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAuthenticated: (organisation: string) => Promise<void> | void;
}) {
  const [org, setOrg] = useState<string>("");
  const [stage, setStage] = useState<"select" | "connecting" | "verified">("select");

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (stage === "select") onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="size-4" /> CPSE Single Sign-On
          </DialogTitle>
          <DialogDescription>
            Federated authentication against your organisation's identity provider (simulated).
          </DialogDescription>
        </DialogHeader>

        {stage === "select" ? (
          <div className="space-y-1.5">
            <Label htmlFor="sso-org">Select organisation</Label>
            <Select value={org} onValueChange={setOrg}>
              <SelectTrigger id="sso-org">
                <SelectValue placeholder="Choose your CPSE" />
              </SelectTrigger>
              <SelectContent>
                {SSO_ORGANISATIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <ol className="space-y-2 text-sm" aria-live="polite">
            <li className="flex items-center gap-2">
              {stage === "connecting" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <BadgeCheck className="size-4 text-success" />
              )}
              Connecting to CPSE Identity Provider…
            </li>
            {stage === "verified" ? (
              <li className="flex items-center gap-2 text-success">
                <BadgeCheck className="size-4" /> Identity verified
              </li>
            ) : null}
          </ol>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={stage !== "select"}>
            Cancel
          </Button>
          <Button
            disabled={!org || stage !== "select"}
            onClick={async () => {
              setStage("connecting");
              await wait(800);
              setStage("verified");
              await wait(450);
              await onAuthenticated(org);
            }}
          >
            {stage !== "select" ? <Loader2 className="size-4 animate-spin" /> : null}
            Continue with SSO
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

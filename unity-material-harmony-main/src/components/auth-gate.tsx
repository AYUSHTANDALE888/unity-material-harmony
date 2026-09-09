"use client";

import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { allowedModules, moduleAllowed, useAuth } from "@/lib/auth";

/** Blocks every internal module until a session exists, then enforces the role matrix. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const href = useRouterState({ select: (s) => s.location.href });

  useEffect(() => {
    if (ready && !session) {
      navigate({ to: "/login", search: { redirect: href }, replace: true });
    }
  }, [ready, session, href, navigate]);

  if (!ready || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">Verifying your session…</p>
        </div>
      </div>
    );
  }

  if (!moduleAllowed(session.user.role, pathname)) {
    const modules = allowedModules(session.user.role);
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="max-w-md rounded-sm border border-border bg-card p-6 text-center">
          <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-warning/15 text-warning">
            <ShieldAlert className="size-5" aria-hidden />
          </span>
          <h1 className="mt-4 text-lg font-semibold text-foreground">Access restricted</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your role <strong>{session.user.role}</strong> is not authorised for this module. Contact the NUMM
            Programme Office if you require additional entitlements.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Modules available to you: {modules.includes("*") ? "all modules" : modules.join(", ")}
          </p>
          <div className="mt-5">
            <Button asChild>
              <Link to="/">Return to overview</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

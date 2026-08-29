import { AlertTriangle, ArrowDown, ArrowUp, Inbox, Loader2, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { MatchType, Severity } from "@/data/types";

/* ------------------------------ formatters ------------------------------ */
export const fmtInt = (n: number) => n.toLocaleString("en-IN");
export const fmtPct = (n: number, d = 1) => `${n.toFixed(d)}%`;
export const fmtCr = (n: number) => `₹${fmtInt(n)} Cr`;
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
export const fmtDateTime = (iso: string) =>
  `${fmtDate(iso)} ${new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
export const relTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} d ago`;
};

/* -------------------------------- badges -------------------------------- */
const badgeBase =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide";

const STATUS_STYLES: Record<string, string> = {
  mapped: "border-success/30 bg-success-surface text-success",
  approved: "border-success/30 bg-success-surface text-success",
  active: "border-success/30 bg-success-surface text-success",
  completed: "border-success/30 bg-success-surface text-success",
  connected: "border-success/30 bg-success-surface text-success",
  resolved: "border-success/30 bg-success-surface text-success",
  standardized: "border-info/30 bg-info-surface text-info",
  recommended: "border-info/30 bg-info-surface text-info",
  ready: "border-info/30 bg-info-surface text-info",
  syncing: "border-info/30 bg-info-surface text-info",
  acknowledged: "border-info/30 bg-info-surface text-info",
  "under-review": "border-warning/30 bg-warning-surface text-warning",
  pending: "border-warning/30 bg-warning-surface text-warning",
  "pending-approval": "border-warning/30 bg-warning-surface text-warning",
  validating: "border-warning/30 bg-warning-surface text-warning",
  warning: "border-warning/30 bg-warning-surface text-warning",
  open: "border-warning/30 bg-warning-surface text-warning",
  executing: "border-warning/30 bg-warning-surface text-warning",
  "duplicate-candidate": "border-critical/30 bg-critical-surface text-critical",
  rejected: "border-critical/30 bg-critical-surface text-critical",
  failed: "border-critical/30 bg-critical-surface text-critical",
  offline: "border-critical/30 bg-critical-surface text-critical",
  unstandardized: "border-border bg-neutral-surface text-muted-foreground",
  "not-submitted": "border-border bg-neutral-surface text-muted-foreground",
  detected: "border-border bg-neutral-surface text-muted-foreground",
  draft: "border-border bg-neutral-surface text-muted-foreground",
  retired: "border-border bg-neutral-surface text-muted-foreground",
  "kept-separate": "border-border bg-neutral-surface text-muted-foreground",
  dismissed: "border-border bg-neutral-surface text-muted-foreground",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn(badgeBase, STATUS_STYLES[status] ?? "border-border bg-neutral-surface text-muted-foreground", className)}>
      {status.replace(/-/g, " ")}
    </span>
  );
}

export function ConfidenceBadge({ value, className }: { value: number | null; className?: string }) {
  if (value === null)
    return <span className="text-xs text-muted-foreground">—</span>;
  const tone =
    value >= 95
      ? "border-success/30 bg-success-surface text-success"
      : value >= 88
        ? "border-info/30 bg-info-surface text-info"
        : value >= 80
          ? "border-warning/30 bg-warning-surface text-warning"
          : "border-critical/30 bg-critical-surface text-critical";
  return (
    <span className={cn(badgeBase, "numeric", tone, className)} title="Similarity score (simulated matching engine)">
      {value.toFixed(1)}%
    </span>
  );
}

export const MATCH_LABELS: Record<MatchType, string> = {
  "exact-match": "Exact match",
  "near-duplicate": "Near duplicate",
  "functional-equivalent": "Functional equivalent",
  "potential-conflict": "Potential conflict",
  "no-match": "No match",
};

export function MatchTypeBadge({ type }: { type: MatchType }) {
  const tone: Record<MatchType, string> = {
    "exact-match": "border-success/30 bg-success-surface text-success",
    "near-duplicate": "border-info/30 bg-info-surface text-info",
    "functional-equivalent": "border-primary/25 bg-accent text-accent-foreground",
    "potential-conflict": "border-warning/30 bg-warning-surface text-warning",
    "no-match": "border-border bg-neutral-surface text-muted-foreground",
  };
  return <span className={cn(badgeBase, tone[type])}>{MATCH_LABELS[type]}</span>;
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const tone: Record<Severity, string> = {
    critical: "border-critical/40 bg-critical-surface text-critical",
    high: "border-warning/40 bg-warning-surface text-warning",
    medium: "border-info/30 bg-info-surface text-info",
    low: "border-border bg-neutral-surface text-muted-foreground",
  };
  return <span className={cn(badgeBase, tone[severity])}>{severity}</span>;
}

/* ------------------------------- surfaces ------------------------------- */
export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  meta,
}: {
  title: string;
  description?: string;
  breadcrumb?: { label: string; to?: string }[];
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="border-b border-border bg-card px-6 py-5">
      {breadcrumb?.length ? (
        <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {breadcrumb.map((b, i) => (
            <span key={b.label} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden>/</span>}
              {b.to ? (
                <Link to={b.to} className="hover:text-foreground hover:underline">
                  {b.label}
                </Link>
              ) : (
                <span className="text-foreground">{b.label}</span>
              )}
            </span>
          ))}
        </nav>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description ? (
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
          ) : null}
          {meta ? <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">{meta}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("panel overflow-hidden", className)}>
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  trend,
  tone = "neutral",
  onClick,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: { value: string; direction: "up" | "down"; good?: boolean };
  tone?: "neutral" | "success" | "warning" | "critical" | "info";
  onClick?: () => void;
}) {
  const accent: Record<string, string> = {
    neutral: "before:bg-border",
    success: "before:bg-success",
    warning: "before:bg-warning",
    critical: "before:bg-critical",
    info: "before:bg-info",
  };
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      {...(onClick ? { onClick, type: "button" as const } : {})}
      className={cn(
        "panel relative w-full overflow-hidden p-4 text-left before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-['']",
        accent[tone],
        onClick && "transition-colors hover:bg-surface",
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="numeric mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <div className="mt-1 flex items-center gap-2">
        {sub ? <span className="text-xs text-muted-foreground">{sub}</span> : null}
        {trend ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium",
              trend.good === false ? "text-critical" : "text-success",
            )}
          >
            {trend.direction === "up" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
            {trend.value}
          </span>
        ) : null}
      </div>
    </Comp>
  );
}

export function ChartCard({
  title,
  description,
  actions,
  children,
  footer,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="panel flex flex-col overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {actions}
      </div>
      <div className="flex-1 p-3">{children}</div>
      {footer ? <div className="border-t border-border bg-surface px-4 py-2 text-xs text-muted-foreground">{footer}</div> : null}
    </section>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="flex size-10 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground">
        {icon ?? <Inbox className="size-5" />}
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description ? <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="flex size-10 items-center justify-center rounded-md border border-critical/30 bg-critical-surface text-critical">
        <AlertTriangle className="size-5" />
      </div>
      <p className="text-sm font-semibold text-foreground">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="size-3.5" /> Retry
        </Button>
      ) : null}
    </div>
  );
}

export function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-4" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className="h-6 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function InlineSpinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="size-3.5 animate-spin" /> {label ?? "Loading"}
    </span>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function DetailRow({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-2 last:border-0 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="w-56 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("text-sm text-foreground", mono && "code-token")}>{value}</dd>
    </div>
  );
}

export function Timeline({
  items,
}: {
  items: {
    title: string;
    meta: string;
    body?: string | undefined;
    tone?: "success" | "warning" | "info" | "neutral" | undefined;
  }[];
}) {
  const dot: Record<string, string> = {
    success: "bg-success",
    warning: "bg-warning",
    info: "bg-info",
    neutral: "bg-border",
  };
  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {items.map((it, i) => (
        <li key={i} className="relative">
          <span
            className={cn("absolute -left-[27px] top-1.5 size-2.5 rounded-full ring-2 ring-card", dot[it.tone ?? "neutral"])}
            aria-hidden
          />
          <p className="text-sm font-medium text-foreground">{it.title}</p>
          <p className="text-xs text-muted-foreground">{it.meta}</p>
          {it.body ? <p className="mt-1 text-sm text-muted-foreground">{it.body}</p> : null}
        </li>
      ))}
    </ol>
  );
}

export function MetricBar({ value, tone = "info", label }: { value: number; tone?: "info" | "success" | "warning" | "critical"; label?: string }) {
  const bg: Record<string, string> = {
    info: "bg-info",
    success: "bg-success",
    warning: "bg-warning",
    critical: "bg-critical",
  };
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-strong">
        <div className={cn("h-full rounded-full", bg[tone])} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      <span className="numeric w-12 shrink-0 text-right text-xs text-muted-foreground">{label ?? `${value.toFixed(0)}%`}</span>
    </div>
  );
}

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

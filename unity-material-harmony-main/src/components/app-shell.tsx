import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  BadgeCheck,
  Bell,
  Boxes,
  ChevronLeft,
  CircleHelp,
  Copy,
  Database,
  FileClock,
  GitCompareArrows,
  Layers,
  LayoutDashboard,
  Link2,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Search,
  Settings,
  ShieldCheck,
  Truck,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CPSES, ROLES, USERS } from "@/data/dataset";
import { useNumm } from "@/store/numm-store";
import { relTime, StatusBadge } from "@/components/kit";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard, group: "Operations" },
  { to: "/materials", label: "Material Master", icon: Boxes, group: "Operations" },
  { to: "/harmonize", label: "Match & Harmonize", icon: GitCompareArrows, group: "Harmonisation" },
  { to: "/duplicates", label: "Duplicate Detection", icon: Copy, group: "Harmonisation" },
  { to: "/standardization", label: "Standardization", icon: BadgeCheck, group: "Harmonisation" },
  { to: "/classification", label: "Classification", icon: Layers, group: "Harmonisation" },
  { to: "/national-codes", label: "National Codes", icon: Database, group: "Mapping" },
  { to: "/mapping", label: "CPSE Mapping", icon: Link2, group: "Mapping" },
  { to: "/migration", label: "Migration", icon: Truck, group: "Mapping" },
  { to: "/analytics", label: "Analytics", icon: Activity, group: "Governance" },
  { to: "/governance", label: "Governance", icon: ShieldCheck, group: "Governance" },
  { to: "/integrations", label: "Integrations", icon: Plug, group: "Governance" },
  { to: "/audit", label: "Audit Trail", icon: FileClock, group: "Governance" },
  { to: "/settings", label: "Settings", icon: Settings, group: "Governance" },
] as const;

const GROUPS = ["Operations", "Harmonisation", "Mapping", "Governance"] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed, toggleSidebar } = useNumm();
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopHeader />
        <main className="min-w-0 flex-1">{children}</main>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card px-6 py-3 text-xs text-muted-foreground">
          <span>National Unified Material Master · Build 2.4.1 (prototype) · Data as on 26 Aug 2026</span>
          <span>Master data governance framework NUMM-GOV-2026 · Simulated matching engine v1.8</span>
        </footer>
      </div>
    </div>
  );
}

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { metrics } = useNumm();

  const counts: Record<string, number> = {
    "/harmonize": metrics.pendingReview,
    "/governance": metrics.openGovernance,
    "/mapping": metrics.pendingMappings,
  };

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex",
        collapsed ? "w-[68px]" : "w-64",
      )}
    >
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
          NM
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">NUMM</p>
            <p className="truncate text-[11px] leading-tight text-sidebar-foreground/65">One Nation • One Material Code</p>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <nav className="space-y-4 px-2 py-3" aria-label="Primary">
          {GROUPS.map((group) => (
            <div key={group}>
              {!collapsed && (
                <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/45">
                  {group}
                </p>
              )}
              <ul className="space-y-0.5">
                {NAV.filter((n) => n.group === group).map((item) => {
                  const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                  const badge = counts[item.to];
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-sm px-2 py-2 text-sm transition-colors",
                          active
                            ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-[inset_2px_0_0_0_var(--sidebar-primary)]"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                          collapsed && "justify-center px-0",
                        )}
                      >
                        <item.icon className="size-4 shrink-0" aria-hidden />
                        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                        {!collapsed && badge ? (
                          <span className="numeric rounded-sm bg-sidebar-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-sidebar-primary-foreground">
                            {badge}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </ScrollArea>

      <div className="border-t border-sidebar-border p-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-xs text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          {!collapsed && <span>Collapse navigation</span>}
        </button>
      </div>
    </aside>
  );
}

function TopHeader() {
  const { state, dispatch, metrics, sidebarCollapsed, toggleSidebar } = useNumm();
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-header px-3 text-header-foreground md:px-4">
      <Button
        variant="ghost"
        size="icon"
        className="text-header-foreground hover:bg-white/10 md:hidden"
        onClick={toggleSidebar}
        aria-label="Toggle navigation"
      >
        {sidebarCollapsed ? <PanelLeftOpen className="size-4" /> : <ChevronLeft className="size-4" />}
      </Button>

      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-sm border border-white/15 bg-white/8 px-3 text-left text-sm text-header-foreground/70 transition-colors hover:bg-white/12 lg:max-w-xl"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="truncate">Search material codes, descriptions, national codes, audit events…</span>
        <kbd className="ml-auto hidden shrink-0 rounded border border-white/20 px-1.5 py-0.5 text-[10px] lg:inline">Ctrl K</kbd>
      </button>

      <span className="hidden items-center gap-1.5 rounded-sm border border-warning/40 bg-warning/15 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-warning-surface xl:inline-flex">
        Prototype Environment
      </span>

      <Select value={state.activeCpse} onValueChange={(v) => dispatch({ type: "cpse/active", id: v })}>
        <SelectTrigger
          className="hidden h-9 w-[190px] border-white/15 bg-white/8 text-sm text-header-foreground focus-visible:ring-white/40 lg:flex"
          aria-label="Current CPSE"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All CPSEs (National view)</SelectItem>
          {CPSES.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.shortName} — {c.sector}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <NotificationBell />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-header-foreground hover:bg-white/10"
            onClick={() => setHelpOpen(true)}
            aria-label="Help and demo guide"
          >
            <CircleHelp className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Help & demo walkthrough</TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-sm px-1.5 py-1 text-left hover:bg-white/10"
            aria-label="User menu"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-white/15 text-xs font-semibold">
              {state.user.name
                .split(" ")
                .map((p) => p[0])
                .join("")}
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className="block truncate text-xs font-semibold leading-tight">{state.user.name}</span>
              <span className="block truncate text-[11px] leading-tight text-header-foreground/65">{state.user.role}</span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>
            <span className="block text-sm">{state.user.name}</span>
            <span className="block text-xs font-normal text-muted-foreground">
              EMP-40218 · Session started {relTime(new Date(Date.now() - 3_600_000).toISOString())}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Simulated role
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={state.user.role}
            onValueChange={(role) => {
              dispatch({ type: "user/role", role });
              toast.success(`Role switched to ${role}`, {
                description: "Navigation and approval permissions updated for this session.",
              });
            }}
          >
            {ROLES.map((r) => (
              <DropdownMenuRadioItem key={r} value={r}>
                {r}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Switch demo user
          </DropdownMenuLabel>
          {USERS.slice(0, 4).map((u) => (
            <DropdownMenuItem
              key={u.name}
              onClick={() => {
                dispatch({ type: "user/switch", user: u });
                toast.success(`Signed in as ${u.name}`, { description: u.role });
              }}
            >
              <UserRound className="size-3.5" /> {u.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() =>
              toast.info("Sign-out is disabled in the prototype environment", {
                description: "Authentication is simulated for the demonstration session.",
              })
            }
          >
            <LogOut className="size-3.5" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      <span className="sr-only" aria-live="polite">
        {metrics.unread} unread notifications
      </span>
    </header>
  );
}

function NotificationBell() {
  const { state, dispatch, metrics } = useNumm();
  const navigate = useNavigate();
  const visible = state.notifications.filter((n) => !n.dismissed).slice(0, 12);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-header-foreground hover:bg-white/10"
          aria-label={`Notifications (${metrics.unread} unread)`}
        >
          <Bell className="size-4" />
          {metrics.unread > 0 && (
            <span className="numeric absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[10px] font-bold text-critical-foreground">
              {metrics.unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "notification/readAll" })}>
            Mark all read
          </Button>
        </div>
        <ScrollArea className="max-h-[380px]">
          {visible.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">No notifications.</p>
          ) : (
            <ul className="divide-y divide-border">
              {visible.map((n) => (
                <li key={n.id} className={cn("px-3 py-2.5", !n.read && "bg-info-surface/40")}>
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        dispatch({ type: "notification/read", id: n.id });
                        if (n.link) navigate({ to: n.link });
                      }}
                    >
                      <p className="text-sm font-medium text-foreground">{n.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{relTime(n.timestamp)}</p>
                    </button>
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-[11px]"
                        onClick={() =>
                          dispatch({ type: n.read ? "notification/unread" : "notification/read", id: n.id })
                        }
                      >
                        {n.read ? "Unread" : "Read"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-[11px]"
                        onClick={() => dispatch({ type: "notification/dismiss", id: n.id })}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { state, cpseName } = useNumm();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return null;
    const has = (v: unknown) => String(v ?? "").toLowerCase().includes(term);
    return {
      materials: state.materials
        .filter((m) => has(m.cpseCode) || has(m.description) || has(m.standardDescription) || has(m.specification))
        .slice(0, 6),
      codes: state.nationalCodes
        .filter((c) => has(c.code) || has(c.standardDescription) || has(c.category))
        .slice(0, 5),
      clusters: state.clusters.filter((c) => has(c.id) || has(c.recommendation.standardDescription)).slice(0, 4),
      audit: state.audit.filter((a) => has(a.entity) || has(a.action) || has(a.user)).slice(0, 4),
      users: USERS.filter((u) => has(u.name) || has(u.role)).slice(0, 3),
    };
  }, [q, state]);

  const go = (to: string) => {
    onOpenChange(false);
    setQ("");
    navigate({ to });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="text-sm">Global search</DialogTitle>
          <DialogDescription className="text-xs">
            Search across material codes, national codes, harmonisation clusters, audit events and users.
          </DialogDescription>
        </DialogHeader>
        <div className="border-b border-border p-3">
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. 6205, gate valve, NUMM-BRG, DUP-4801, Rajesh"
            aria-label="Search query"
          />
        </div>
        <ScrollArea className="max-h-[420px]">
          {!results ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Type at least two characters to search the registry.
            </p>
          ) : Object.values(results).every((r) => r.length === 0) ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              No records matched “{q}”. Try a material code, description keyword or cluster ID.
            </p>
          ) : (
            <div className="divide-y divide-border">
              <ResultGroup label="Material records" count={results.materials.length}>
                {results.materials.map((m) => (
                  <ResultRow
                    key={m.id}
                    title={`${m.cpseCode} · ${m.description}`}
                    meta={`${cpseName(m.cpseId)} · ${m.category} · ${m.uom}`}
                    right={<StatusBadge status={m.status} />}
                    onSelect={() => go(`/materials/${m.id}`)}
                  />
                ))}
              </ResultGroup>
              <ResultGroup label="National material codes" count={results.codes.length}>
                {results.codes.map((c) => (
                  <ResultRow
                    key={c.id}
                    title={`${c.code} · ${c.standardDescription}`}
                    meta={`${c.category} · ${c.mappedLegacyCodes} legacy codes mapped`}
                    right={<StatusBadge status={c.status} />}
                    onSelect={() => go("/national-codes")}
                  />
                ))}
              </ResultGroup>
              <ResultGroup label="Harmonisation clusters" count={results.clusters.length}>
                {results.clusters.map((c) => (
                  <ResultRow
                    key={c.id}
                    title={`${c.id} · ${c.recommendation.standardDescription}`}
                    meta={`${c.memberIds.length} member records · similarity ${c.similarity.toFixed(1)}%`}
                    right={<StatusBadge status={c.status} />}
                    onSelect={() => go("/harmonize")}
                  />
                ))}
              </ResultGroup>
              <ResultGroup label="Audit events" count={results.audit.length}>
                {results.audit.map((a) => (
                  <ResultRow
                    key={a.id}
                    title={`${a.action} · ${a.entity}`}
                    meta={`${a.user} · ${relTime(a.timestamp)}`}
                    onSelect={() => go("/audit")}
                  />
                ))}
              </ResultGroup>
              <ResultGroup label="Users" count={results.users.length}>
                {results.users.map((u) => (
                  <ResultRow key={u.name} title={u.name} meta={u.role} onSelect={() => go("/settings")} />
                ))}
              </ResultGroup>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function ResultGroup({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  if (!count) return null;
  return (
    <div className="py-2">
      <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label} ({count})
      </p>
      <ul>{children}</ul>
    </div>
  );
}

function ResultRow({
  title,
  meta,
  right,
  onSelect,
}: {
  title: string;
  meta: string;
  right?: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-surface"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-foreground">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">{meta}</span>
        </span>
        {right}
      </button>
    </li>
  );
}

function HelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const steps = [
    ["Overview", "Review national harmonisation posture and duplicate exposure across connected CPSEs."],
    ["Duplicate Detection", "Open a duplicate cluster and inspect similarity evidence across CPSE records."],
    ["Match & Harmonize", "Compare member records attribute-by-attribute and study the recommendation."],
    ["Validation", "Approve, modify, send for engineering review or reject the recommendation."],
    ["CPSE Mapping", "Confirm legacy CPSE codes now resolve to the approved national material code."],
    ["Migration", "Run the legacy migration wizard for the affected CPSE dataset."],
    ["Analytics & Audit", "Verify measurable improvement and complete traceability of every change."],
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Demonstration walkthrough</DialogTitle>
          <DialogDescription>
            NUMM is a prototype environment. Matching, similarity scores and ERP connectivity are simulated using a
            deterministic in-memory dataset; all workflow actions update shared application state.
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-2.5">
          {steps.map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="numeric mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm bg-secondary text-[11px] font-semibold text-secondary-foreground">
                {i + 1}
              </span>
              <span>
                <span className="block text-sm font-medium text-foreground">{t}</span>
                <span className="block text-xs text-muted-foreground">{d}</span>
              </span>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}

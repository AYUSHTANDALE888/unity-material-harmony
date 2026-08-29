import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  EmptyState,
  KpiCard,
  PageHeader,
  Section,
  SeverityBadge,
  StatusBadge,
  fmtDate,
  fmtInt,
} from "@/components/kit";
import { governanceService } from "@/services/api";
import { useNumm } from "@/store/numm-store";
import { downloadFile, toCsv } from "@/lib/export";
import { CPSES } from "@/data/dataset";

export const Route = createFileRoute("/governance")({
  head: () => ({
    meta: [
      { title: "Data Governance & Quality — NUMM" },
      {
        name: "description",
        content:
          "Track data quality exceptions, unit-of-measure conflicts and classification breaches raised across CPSE material masters.",
      },
      { property: "og:title", content: "NUMM data governance" },
      {
        property: "og:description",
        content: "Severity-ranked governance issues with ownership, acknowledgement and resolution workflow.",
      },
    ],
  }),
  component: Governance,
});

function Governance() {
  const { state, dispatch, actor, cpseName, metrics, can } = useNumm();
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("open");
  const [cpse, setCpse] = useState("all");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const t = search.trim().toLowerCase();
    const order = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    return state.governance
      .filter(
        (g) =>
          (severity === "all" || g.severity === severity) &&
          (status === "all" || (status === "open" ? g.status !== "resolved" : g.status === status)) &&
          (cpse === "all" || g.cpseId === cpse) &&
          (!t || g.detail.toLowerCase().includes(t) || g.entity.toLowerCase().includes(t) || g.type.toLowerCase().includes(t)),
      )
      .sort((a, b) => order[a.severity] - order[b.severity]);
  }, [state.governance, severity, status, cpse, search]);

  const byType = useMemo(() => {
    const map = new Map<string, number>();
    state.governance.filter((g) => g.status !== "resolved").forEach((g) => map.set(g.type, (map.get(g.type) ?? 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [state.governance]);

  function exportCsv() {
    const csv = toCsv(
      rows.map((g) => ({
        id: g.id,
        type: g.type,
        severity: g.severity,
        cpse: cpseName(g.cpseId),
        entity: g.entity,
        detail: g.detail,
        owner: g.owner,
        status: g.status,
        raisedOn: fmtDate(g.raisedOn),
      })),
      [
        { key: "id", label: "Issue" },
        { key: "type", label: "Type" },
        { key: "severity", label: "Severity" },
        { key: "cpse", label: "CPSE" },
        { key: "entity", label: "Entity" },
        { key: "detail", label: "Detail" },
        { key: "owner", label: "Owner" },
        { key: "status", label: "Status" },
        { key: "raisedOn", label: "Raised on" },
      ],
    );
    downloadFile(`numm-governance-${Date.now()}.csv`, csv);
    toast.success(`Exported ${rows.length} issues`);
  }

  return (
    <>
      <PageHeader
        title="Data governance & quality"
        description="Standing exceptions that block harmonisation: incomplete attributes, conflicting units, classification breaches and stale records."
        breadcrumb={[{ label: "NUMM", to: "/" }, { label: "Governance" }]}
        meta={
          <>
            <span>{fmtInt(metrics.openGovernance)} open issues</span>
            <span>{fmtInt(metrics.criticalGovernance)} critical</span>
            <span>Average data quality {metrics.dataQuality}%</span>
          </>
        }
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="size-4" /> Export register
          </Button>
        }
      />

      <div className="space-y-4 p-4 md:p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Open issues" value={fmtInt(metrics.openGovernance)} sub="Awaiting owner action" tone="warning" />
          <KpiCard label="Critical" value={fmtInt(metrics.criticalGovernance)} sub="Blocking national code approval" tone="critical" />
          <KpiCard
            label="Resolved"
            value={fmtInt(state.governance.filter((g) => g.status === "resolved").length)}
            sub="Closed in this programme cycle"
            tone="success"
          />
          <KpiCard label="Data quality index" value={`${metrics.dataQuality}%`} sub="Mean completeness of records" tone="info" />
        </div>

        <Section title="Open issues by type" description="Concentration of exception categories">
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {byType.map(([type, count]) => (
              <li key={type} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                <span className="flex items-center gap-2 text-sm">
                  <ShieldAlert className="size-4 text-warning" aria-hidden /> {type}
                </span>
                <span className="numeric text-sm font-semibold">{count}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title="Issue register"
          description={`${rows.length} issues`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search issues"
                className="h-9 w-48"
                aria-label="Search issues"
              />
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger className="h-9 w-36" aria-label="Severity filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 w-36" aria-label="Status filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
              <Select value={cpse} onValueChange={setCpse}>
                <SelectTrigger className="h-9 w-36" aria-label="CPSE filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All CPSEs</SelectItem>
                  {CPSES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.shortName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
          bodyClassName="p-0"
        >
          {rows.length === 0 ? (
            <EmptyState title="No issues match the filters" description="Adjust severity, status or CPSE filters." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Issue</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Detail</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 80).map((g) => (
                    <TableRow key={g.id} className="hover:bg-surface">
                      <TableCell>
                        <span className="code-token">{g.id}</span>
                        <span className="block text-[11px] text-muted-foreground">{fmtDate(g.raisedOn)}</span>
                      </TableCell>
                      <TableCell className="text-sm">{g.type}</TableCell>
                      <TableCell>
                        <SeverityBadge severity={g.severity} />
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="code-token">{g.entity}</span>
                        <span className="block text-[11px] text-muted-foreground">{cpseName(g.cpseId)}</span>
                      </TableCell>
                      <TableCell className="max-w-[300px] text-sm text-muted-foreground">{g.detail}</TableCell>
                      <TableCell className="text-sm">{g.owner}</TableCell>
                      <TableCell>
                        <StatusBadge status={g.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!can("edit") || g.status !== "open"}
                            onClick={() => {
                              dispatch({ type: "governance/status", id: g.id, status: "acknowledged", actor });
                              toast.success(`${g.id} acknowledged`);
                            }}
                          >
                            Acknowledge
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!can("edit") || g.status === "resolved"}
                            onClick={async () => {
                              await governanceService.resolve(g.id);
                              dispatch({ type: "governance/status", id: g.id, status: "resolved", actor });
                              toast.success(`${g.id} resolved`, { description: "Audit event recorded." });
                            }}
                          >
                            Resolve
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Section>
      </div>
    </>
  );
}

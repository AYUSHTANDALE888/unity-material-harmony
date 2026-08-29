import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, KpiCard, PageHeader, Section, StatusBadge, fmtDateTime, fmtInt, relTime } from "@/components/kit";
import { useNumm } from "@/store/numm-store";
import { downloadFile, toCsv } from "@/lib/export";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Audit Trail — NUMM" },
      {
        name: "description",
        content:
          "Immutable audit trail of every standardisation, harmonisation approval, mapping change and migration event on the national material master.",
      },
      { property: "og:title", content: "NUMM audit trail" },
      {
        property: "og:description",
        content: "Who changed what, when, and why — full before/after values with recorded reasons.",
      },
    ],
  }),
  component: Audit,
});

function Audit() {
  const { state } = useNumm();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [role, setRole] = useState("all");

  const roles = useMemo(() => [...new Set(state.audit.map((a) => a.role))], [state.audit]);

  const rows = useMemo(() => {
    const t = search.trim().toLowerCase();
    return state.audit.filter(
      (a) =>
        (status === "all" || a.status === status) &&
        (role === "all" || a.role === role) &&
        (!t ||
          a.action.toLowerCase().includes(t) ||
          a.entity.toLowerCase().includes(t) ||
          a.user.toLowerCase().includes(t) ||
          a.reason.toLowerCase().includes(t)),
    );
  }, [state.audit, search, status, role]);

  function exportCsv() {
    const csv = toCsv(
      rows.map((a) => ({
        id: a.id,
        timestamp: fmtDateTime(a.timestamp),
        user: a.user,
        role: a.role,
        action: a.action,
        entity: a.entity,
        previousValue: a.previousValue,
        newValue: a.newValue,
        reason: a.reason,
        status: a.status,
      })),
      [
        { key: "id", label: "Event" },
        { key: "timestamp", label: "Timestamp" },
        { key: "user", label: "User" },
        { key: "role", label: "Role" },
        { key: "action", label: "Action" },
        { key: "entity", label: "Entity" },
        { key: "previousValue", label: "Previous value" },
        { key: "newValue", label: "New value" },
        { key: "reason", label: "Reason" },
        { key: "status", label: "Result" },
      ],
    );
    downloadFile(`numm-audit-trail-${Date.now()}.csv`, csv);
    toast.success(`Exported ${rows.length} audit events`);
  }

  return (
    <>
      <PageHeader
        title="Audit trail"
        description="Every material, code and mapping change is recorded with actor, role, before/after value and mandatory reason."
        breadcrumb={[{ label: "NUMM", to: "/" }, { label: "Audit Trail" }]}
        meta={
          <>
            <span>{fmtInt(state.audit.length)} events</span>
            <span>Latest {state.audit[0] ? relTime(state.audit[0].timestamp) : "—"}</span>
            <span>Retention: 10 years (CVC compliant)</span>
          </>
        }
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="size-4" /> Export trail
          </Button>
        }
      />

      <div className="space-y-4 p-4 md:p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Total events" value={fmtInt(state.audit.length)} sub="Since programme inception" />
          <KpiCard
            label="Approvals recorded"
            value={fmtInt(state.audit.filter((a) => a.action.toLowerCase().includes("approv")).length)}
            sub="Harmonisation and mapping decisions"
            tone="success"
          />
          <KpiCard
            label="Warnings"
            value={fmtInt(state.audit.filter((a) => a.status === "warning").length)}
            sub="Rejections and reversals"
            tone="warning"
          />
          <KpiCard label="Distinct actors" value={fmtInt(new Set(state.audit.map((a) => a.user)).size)} sub="Users with recorded actions" tone="info" />
        </div>

        <Section
          title="Event log"
          description={`${rows.length} events`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search action, entity, user or reason"
                className="h-9 w-64"
                aria-label="Search audit trail"
              />
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="h-9 w-48" aria-label="Role filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 w-36" aria-label="Result filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All results</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
          bodyClassName="p-0"
        >
          {rows.length === 0 ? (
            <EmptyState title="No audit events match the filters" description="Clear the search or role filter." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Previous → new</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 120).map((a) => (
                    <TableRow key={a.id} className="hover:bg-surface">
                      <TableCell className="code-token">{a.id}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDateTime(a.timestamp)}</TableCell>
                      <TableCell className="text-sm">
                        {a.user}
                        <span className="block text-[11px] text-muted-foreground">{a.role}</span>
                      </TableCell>
                      <TableCell className="text-sm">{a.action}</TableCell>
                      <TableCell className="code-token">{a.entity}</TableCell>
                      <TableCell className="max-w-[280px] text-xs">
                        <span className="text-muted-foreground line-through">{a.previousValue}</span>
                        <span className="mt-0.5 block text-foreground">{a.newValue}</span>
                      </TableCell>
                      <TableCell className="max-w-[220px] text-xs text-muted-foreground">{a.reason}</TableCell>
                      <TableCell>
                        <StatusBadge status={a.status} />
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

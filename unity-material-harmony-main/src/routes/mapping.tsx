import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, Download, Link2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  EmptyState,
  Field,
  KpiCard,
  PageHeader,
  Section,
  StatusBadge,
  fmtDate,
  fmtInt,
} from "@/components/kit";
import { ReasonDialog } from "@/components/dialogs";
import { CPSES } from "@/data/dataset";
import type { Mapping } from "@/data/types";
import { mappingService } from "@/services/api";
import { useNumm } from "@/store/numm-store";
import { downloadFile, toCsv } from "@/lib/export";

export const Route = createFileRoute("/mapping")({
  head: () => ({
    meta: [
      { title: "CPSE ↔ National Code Mapping — NUMM" },
      {
        name: "description",
        content:
          "Maintain the crosswalk between legacy CPSE material codes and approved national material codes, with approval and retirement controls.",
      },
      { property: "og:title", content: "NUMM code mapping register" },
      {
        property: "og:description",
        content: "Legacy-to-national code crosswalk with bulk approval, editing and audit-tracked retirement.",
      },
    ],
  }),
  component: MappingPage,
});

function MappingPage() {
  const { state, dispatch, actor, cpseName, can, metrics } = useNumm();
  const [search, setSearch] = useState("");
  const [cpse, setCpse] = useState("all");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Mapping | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Mapping | null>(null);

  const rows = useMemo(() => {
    const t = search.trim().toLowerCase();
    return state.mappings.filter(
      (m) =>
        (cpse === "all" || m.cpseId === cpse) &&
        (status === "all" || m.status === status) &&
        (!t || m.nationalCode.toLowerCase().includes(t) || m.cpseCode.toLowerCase().includes(t)),
    );
  }, [state.mappings, search, cpse, status]);

  const pendingIds = rows.filter((r) => r.status === "pending").map((r) => r.id);

  function exportCsv() {
    const csv = toCsv(
      rows.map((m) => ({
        nationalCode: m.nationalCode,
        cpse: cpseName(m.cpseId),
        cpseCode: m.cpseCode,
        status: m.status,
        mappedOn: fmtDate(m.mappedOn),
        approvedBy: m.approvedBy ?? "—",
      })),
      [
        { key: "nationalCode", label: "National code" },
        { key: "cpse", label: "CPSE" },
        { key: "cpseCode", label: "Legacy code" },
        { key: "status", label: "Status" },
        { key: "mappedOn", label: "Mapped on" },
        { key: "approvedBy", label: "Approved by" },
      ],
    );
    downloadFile(`numm-code-mapping-${Date.now()}.csv`, csv);
    toast.success(`Exported ${rows.length} mappings`);
  }

  return (
    <>
      <PageHeader
        title="CPSE ↔ national code mapping"
        description="Every legacy CPSE material code retains a traceable link to its approved national material code."
        breadcrumb={[{ label: "NUMM", to: "/" }, { label: "Code Mapping" }]}
        meta={
          <>
            <span>{fmtInt(state.mappings.length)} mappings</span>
            <span>{fmtInt(metrics.activeMappings)} active</span>
            <span>{fmtInt(metrics.pendingMappings)} pending approval</span>
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="size-4" /> Export
            </Button>
            <Button onClick={() => setAddOpen(true)} disabled={!can("map")}>
              <Plus className="size-4" /> New mapping
            </Button>
          </>
        }
      />

      <div className="space-y-4 p-4 md:p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Active mappings" value={fmtInt(metrics.activeMappings)} sub="Live in the national master" tone="success" />
          <KpiCard label="Pending approval" value={fmtInt(metrics.pendingMappings)} sub="Awaiting governance sign-off" tone="warning" />
          <KpiCard label="National codes" value={fmtInt(metrics.nationalCodes)} sub="Active harmonised codes" tone="info" />
          <KpiCard label="Legacy codes remaining" value={fmtInt(metrics.projection.legacyCodes)} sub="Not yet mapped" />
        </div>

        <Section
          title="Mapping register"
          description={`${rows.length} rows`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="National or legacy code"
                className="h-9 w-56"
                aria-label="Search mappings"
              />
              <Select value={cpse} onValueChange={setCpse}>
                <SelectTrigger className="h-9 w-40" aria-label="CPSE filter">
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
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 w-36" aria-label="Status filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={!can("map") || pendingIds.length === 0}
                onClick={async () => {
                  await mappingService.write("approve", pendingIds);
                  dispatch({ type: "mapping/approve", ids: pendingIds, actor });
                  toast.success(`${pendingIds.length} mappings approved`);
                }}
              >
                <Check className="size-4" /> Approve pending ({pendingIds.length})
              </Button>
            </div>
          }
          bodyClassName="p-0"
        >
          {rows.length === 0 ? (
            <EmptyState title="No mappings match the filters" description="Clear the CPSE or status filter to see more rows." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selected.length > 0 && selected.length === rows.length}
                        onCheckedChange={(v) => setSelected(v ? rows.map((r) => r.id) : [])}
                        aria-label="Select all mappings"
                      />
                    </TableHead>
                    <TableHead>National code</TableHead>
                    <TableHead>CPSE</TableHead>
                    <TableHead>Legacy code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mapped on</TableHead>
                    <TableHead>Approved by</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 80).map((m) => (
                    <TableRow key={m.id} className="hover:bg-surface">
                      <TableCell>
                        <Checkbox
                          checked={selected.includes(m.id)}
                          onCheckedChange={(v) =>
                            setSelected((prev) => (v ? [...prev, m.id] : prev.filter((id) => id !== m.id)))
                          }
                          aria-label={`Select ${m.cpseCode}`}
                        />
                      </TableCell>
                      <TableCell className="code-token">{m.nationalCode}</TableCell>
                      <TableCell className="text-sm">{cpseName(m.cpseId)}</TableCell>
                      <TableCell className="code-token">{m.cpseCode}</TableCell>
                      <TableCell>
                        <StatusBadge status={m.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(m.mappedOn)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.approvedBy ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" disabled={!can("map")} onClick={() => setEditing(m)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!can("map")}
                            onClick={() => setRemoveTarget(m)}
                            aria-label={`Retire mapping ${m.cpseCode}`}
                          >
                            <Trash2 className="size-3.5" />
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

        {selected.length > 0 ? (
          <div className="sticky bottom-4 flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-3 shadow-lg">
            <Link2 className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">{selected.length} selected</span>
            <Button
              size="sm"
              disabled={!can("map")}
              onClick={() => {
                dispatch({ type: "mapping/approve", ids: selected, actor });
                toast.success(`${selected.length} mappings approved`);
                setSelected([]);
              }}
            >
              Approve selected
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
              Clear selection
            </Button>
          </div>
        ) : null}
      </div>

      <MappingDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={(payload) => {
          dispatch({
            type: "mapping/add",
            mapping: {
              nationalCode: payload.nationalCode,
              cpseId: payload.cpseId,
              cpseCode: payload.cpseCode,
              materialId: null,
              status: "pending",
              mappedOn: new Date().toISOString(),
              approvedBy: null,
              note: payload.note,
            },
            actor,
          });
          toast.success("Mapping created", { description: `${payload.cpseCode} → ${payload.nationalCode}` });
        }}
      />

      {editing ? (
        <MappingDialog
          open
          onOpenChange={(v) => !v && setEditing(null)}
          initial={editing}
          onSubmit={(payload) => {
            dispatch({
              type: "mapping/update",
              id: editing.id,
              patch: { nationalCode: payload.nationalCode, cpseCode: payload.cpseCode, note: payload.note },
              reason: payload.note || "Mapping corrected",
              actor,
            });
            toast.success("Mapping updated");
            setEditing(null);
          }}
        />
      ) : null}

      <ReasonDialog
        open={Boolean(removeTarget)}
        onOpenChange={(v) => !v && setRemoveTarget(null)}
        title="Retire mapping"
        description="The legacy code will be unlinked from the national code. The action is recorded in the audit trail."
        confirmLabel="Retire mapping"
        destructive
        defaultReason="Mapping superseded by revised harmonisation decision"
        onConfirm={(reason) => {
          if (!removeTarget) return;
          dispatch({ type: "mapping/remove", id: removeTarget.id, reason, actor });
          toast.success(`${removeTarget.cpseCode} retired`);
          setRemoveTarget(null);
        }}
      />
    </>
  );
}

function MappingDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Mapping;
  onSubmit: (payload: { nationalCode: string; cpseId: string; cpseCode: string; note: string }) => void;
}) {
  const { state } = useNumm();
  const [nationalCode, setNationalCode] = useState(initial?.nationalCode ?? state.nationalCodes[0]?.code ?? "");
  const [cpseId, setCpseId] = useState(initial?.cpseId ?? CPSES[0]!.id);
  const [cpseCode, setCpseCode] = useState(initial?.cpseCode ?? "");
  const [note, setNote] = useState(initial?.note ?? "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit mapping" : "Create mapping"}</DialogTitle>
          <DialogDescription>Link a legacy CPSE material code to an approved national material code.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="National material code">
            <Select value={nationalCode} onValueChange={setNationalCode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {state.nationalCodes.slice(0, 80).map((c) => (
                  <SelectItem key={c.id} value={c.code}>
                    {c.code} — {c.standardDescription.slice(0, 40)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="CPSE">
            <Select value={cpseId} onValueChange={setCpseId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CPSES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Legacy CPSE code">
            <Input value={cpseCode} onChange={(e) => setCpseCode(e.target.value)} placeholder="e.g. ONGC-4100238" />
          </Field>
          <Field label="Note / reason">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!nationalCode || cpseCode.trim().length < 3}
            onClick={() => {
              onSubmit({ nationalCode, cpseId, cpseCode: cpseCode.trim().toUpperCase(), note: note.trim() });
              onOpenChange(false);
            }}
          >
            {initial ? "Save changes" : "Create mapping"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

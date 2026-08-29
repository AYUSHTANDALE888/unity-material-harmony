import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  EmptyState,
  Field,
  InlineSpinner,
  KpiCard,
  PageHeader,
  Section,
  StatusBadge,
  fmtDate,
  fmtInt,
} from "@/components/kit";
import { CATEGORIES, UOMS } from "@/data/dataset";
import { codeService } from "@/services/api";
import { useNumm } from "@/store/numm-store";
import { downloadFile, toCsv } from "@/lib/export";

export const Route = createFileRoute("/national-codes")({
  head: () => ({
    meta: [
      { title: "National Material Code Registry — NUMM" },
      {
        name: "description",
        content:
          "The authoritative registry of approved national material codes, their standard descriptions and the CPSE legacy codes mapped to each.",
      },
      { property: "og:title", content: "NUMM national code registry" },
      {
        property: "og:description",
        content: "Approved national material codes with mapped CPSEs, canonical units and approval provenance.",
      },
    ],
  }),
  component: NationalCodes,
});

function NationalCodes() {
  const navigate = useNavigate();
  const { state, dispatch, actor, metrics, can, cpseName } = useNumm();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [open, setOpen] = useState(false);

  const rows = useMemo(() => {
    const t = search.trim().toLowerCase();
    return state.nationalCodes.filter(
      (c) =>
        (status === "all" || c.status === status) &&
        (category === "all" || c.category === category) &&
        (!t || c.code.toLowerCase().includes(t) || c.standardDescription.toLowerCase().includes(t)),
    );
  }, [state.nationalCodes, search, status, category]);

  function exportCsv() {
    const csv = toCsv(
      rows.map((c) => ({
        code: c.code,
        description: c.standardDescription,
        category: c.category,
        uom: c.uom,
        status: c.status,
        cpses: c.mappedCpses.map(cpseName).join(" / "),
        legacy: c.mappedLegacyCodes,
        approvedOn: c.approvedOn ? fmtDate(c.approvedOn) : "—",
        approvedBy: c.approvedBy ?? "—",
      })),
      [
        { key: "code", label: "National code" },
        { key: "description", label: "Standard description" },
        { key: "category", label: "Category" },
        { key: "uom", label: "UOM" },
        { key: "status", label: "Status" },
        { key: "cpses", label: "Mapped CPSEs" },
        { key: "legacy", label: "Legacy codes mapped" },
        { key: "approvedOn", label: "Approved on" },
        { key: "approvedBy", label: "Approved by" },
      ],
    );
    downloadFile(`numm-national-codes-${Date.now()}.csv`, csv);
    toast.success(`Exported ${rows.length} national codes`);
  }

  return (
    <>
      <PageHeader
        title="National material code registry"
        description="One canonical code per material, carrying the approved standard description, canonical unit and full mapping provenance."
        breadcrumb={[{ label: "NUMM", to: "/" }, { label: "National Codes" }]}
        meta={
          <>
            <span>{fmtInt(state.nationalCodes.length)} codes issued</span>
            <span>{fmtInt(metrics.nationalCodes)} active</span>
            <span>
              {fmtInt(state.nationalCodes.reduce((a, c) => a + c.mappedLegacyCodes, 0))} legacy codes consolidated
            </span>
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="size-4" /> Export
            </Button>
            <Button onClick={() => setOpen(true)} disabled={!can("approve")}>
              <Plus className="size-4" /> Issue national code
            </Button>
          </>
        }
      />

      <div className="space-y-4 p-4 md:p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Active codes" value={fmtInt(metrics.nationalCodes)} sub="Published to all CPSEs" tone="success" />
          <KpiCard
            label="Pending approval"
            value={fmtInt(state.nationalCodes.filter((c) => c.status === "pending-approval").length)}
            sub="Awaiting governance sign-off"
            tone="warning"
          />
          <KpiCard
            label="Draft codes"
            value={fmtInt(state.nationalCodes.filter((c) => c.status === "draft").length)}
            sub="Created but not submitted"
          />
          <KpiCard
            label="Avg legacy codes per national code"
            value={(
              state.nationalCodes.reduce((a, c) => a + c.mappedLegacyCodes, 0) /
              Math.max(1, state.nationalCodes.length)
            ).toFixed(1)}
            sub="Consolidation ratio"
            tone="info"
          />
        </div>

        <Section
          title="Registry"
          description={`${rows.length} codes`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search code or description"
                className="h-9 w-60"
                aria-label="Search national codes"
              />
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9 w-44" aria-label="Category filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 w-40" aria-label="Status filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending-approval">Pending approval</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
          bodyClassName="p-0"
        >
          {rows.length === 0 ? (
            <EmptyState title="No national codes match the filters" description="Clear the search or status filter." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>National code</TableHead>
                    <TableHead>Standard description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>UOM</TableHead>
                    <TableHead>Mapped CPSEs</TableHead>
                    <TableHead className="text-right">Legacy codes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 80).map((c) => (
                    <TableRow key={c.id} className="hover:bg-surface">
                      <TableCell className="code-token">{c.code}</TableCell>
                      <TableCell className="max-w-[320px] text-sm">{c.standardDescription}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.category}</TableCell>
                      <TableCell className="text-sm">{c.uom}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.mappedCpses.map(cpseName).join(", ") || "—"}
                      </TableCell>
                      <TableCell className="numeric text-right">{fmtInt(c.mappedLegacyCodes)}</TableCell>
                      <TableCell>
                        <StatusBadge status={c.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/mapping" })}>
                            Mappings
                          </Button>
                          {c.status !== "active" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!can("approve")}
                              onClick={() => {
                                dispatch({
                                  type: "code/patch",
                                  id: c.id,
                                  patch: {
                                    status: "active",
                                    approvedOn: new Date().toISOString(),
                                    approvedBy: actor.name,
                                  },
                                });
                                dispatch({
                                  type: "audit",
                                  event: {
                                    user: actor.name,
                                    role: actor.role,
                                    action: "National code activated",
                                    entity: c.code,
                                    previousValue: c.status,
                                    newValue: "active",
                                    reason: "Governance approval recorded",
                                    status: "success",
                                  },
                                });
                                toast.success(`${c.code} activated`);
                              }}
                            >
                              Activate
                            </Button>
                          ) : null}
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

      <IssueCodeDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function IssueCodeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { state, dispatch, actor } = useNumm();
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0] ?? "General");
  const [uom, setUom] = useState(UOMS[0] ?? "EA");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const prefix = category.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "X");
    const code = await codeService.generate(prefix, state.codeSeq + 1);
    dispatch({
      type: "code/create",
      code: {
        id: `NC-NEW-${state.codeSeq + 1}`,
        code,
        standardDescription: description.trim().toUpperCase(),
        category,
        uom,
        status: "pending-approval",
        mappedCpses: [],
        mappedLegacyCodes: 0,
        approvedOn: null,
        approvedBy: null,
        clusterId: null,
      },
      actor,
    });
    setBusy(false);
    setDescription("");
    onOpenChange(false);
    toast.success(`${code} issued`, { description: "Submitted for governance approval." });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Issue a national material code</DialogTitle>
          <DialogDescription>
            A new code is generated from the category prefix and the national sequence counter, then queued for approval.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Standard description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="BALL BEARING, DEEP GROOVE, 6205-2Z, BORE 25 MM, SEALED"
            />
          </Field>
          <Field label="Category">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Canonical unit of measure">
            <Select value={uom} onValueChange={setUom}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {UOMS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button disabled={busy || description.trim().length < 10} onClick={submit}>
            {busy ? <InlineSpinner label="Generating code…" /> : "Generate and submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

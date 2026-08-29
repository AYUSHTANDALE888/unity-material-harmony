import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Check,
  CircleSlash,
  MessageSquare,
  Pencil,
  Search,
  Send,
  ShieldQuestion,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ConfidenceBadge,
  DetailRow,
  EmptyState,
  ErrorState,
  Field,
  MatchTypeBadge,
  MetricBar,
  PageHeader,
  Section,
  StatusBadge,
  TableSkeleton,
  fmtDateTime,
  relTime,
} from "@/components/kit";
import { ReasonDialog } from "@/components/dialogs";
import { CATEGORIES } from "@/data/dataset";
import type { DuplicateCluster, Material } from "@/data/types";
import { matchingService } from "@/services/api";
import { useNumm } from "@/store/numm-store";

const REVIEWERS = ["Vikram Iyer", "Farhan Qureshi", "Ananya Sharma", "Sunita Deshmukh", "Rajesh Kumar"];

export const Route = createFileRoute("/harmonize")({
  validateSearch: (search: Record<string, unknown>): { cluster?: string } =>
    typeof search["cluster"] === "string" ? { cluster: search["cluster"] } : {},
  head: () => ({
    meta: [
      { title: "Match & Harmonize — NUMM" },
      {
        name: "description",
        content:
          "Side-by-side comparison of CPSE material records, equivalence analysis and national material code recommendations with human validation.",
      },
      { property: "og:title", content: "NUMM Match & Harmonize workspace" },
      {
        property: "og:description",
        content: "Compare CPSE records attribute-by-attribute, review the recommendation and record an approval decision.",
      },
    ],
  }),
  component: Harmonize,
});

type RowState = "exact" | "equivalent" | "different" | "missing" | "review";

const normalise = (v: string) =>
  v
    .toUpperCase()
    .replace(/\bZZ\b|\b2Z\b/g, "ZZ")
    .replace(/\bNOS\b|\bNO\b|\bPC\b|\bEA\b/g, "EA")
    .replace(/\bMTR\b|\bRMT\b|\bM\b/g, "M")
    .replace(/[^A-Z0-9]/g, "");

function rowState(values: (string | undefined)[]): RowState {
  const present = values.filter(Boolean) as string[];
  if (present.length === 0) return "missing";
  if (present.length !== values.length) return "missing";
  const exact = new Set(present).size === 1;
  if (exact) return "exact";
  const equivalent = new Set(present.map(normalise)).size === 1;
  if (equivalent) return "equivalent";
  const numericish = present.every((p) => /\d/.test(p));
  return numericish ? "different" : "review";
}

const ROW_STYLE: Record<RowState, { label: string; className: string }> = {
  exact: { label: "Exact match", className: "text-success" },
  equivalent: { label: "Equivalent", className: "text-info" },
  different: { label: "Different", className: "text-critical" },
  missing: { label: "Missing", className: "text-warning" },
  review: { label: "Requires review", className: "text-warning" },
};

function Harmonize() {
  const { cluster: clusterParam } = Route.useSearch();
  const navigate = useNavigate();
  const { state, dispatch, actor, cpseName, can } = useNumm();

  const [statuses, setStatuses] = useState<string[]>(["detected", "recommended", "under-review"]);
  const [matchTypes, setMatchTypes] = useState<string[]>([]);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(clusterParam ?? null);

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [modifyOpen, setModifyOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);

  const filters = { statuses, matchTypes, category, search };
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["clusters", filters, state.clusters.length, state.sessionActions],
    queryFn: () => matchingService.list(state.clusters, filters),
  });

  const list = data ?? [];
  const selected = useMemo(
    () => state.clusters.find((c) => c.id === (selectedId ?? list[0]?.id)) ?? null,
    [state.clusters, selectedId, list],
  );

  useEffect(() => {
    if (clusterParam) setSelectedId(clusterParam);
  }, [clusterParam]);

  const members = useMemo(
    () => (selected ? state.materials.filter((m) => selected.memberIds.includes(m.id)) : []),
    [selected, state.materials],
  );

  return (
    <>
      <PageHeader
        title="Match & harmonize"
        description="Compare candidate material records across CPSEs, study the equivalence evidence and record a validation decision."
        breadcrumb={[{ label: "NUMM", to: "/" }, { label: "Match & Harmonize" }]}
        meta={
          <>
            <span>{list.length} clusters in queue</span>
            {selected ? <span>Active cluster {selected.id}</span> : null}
            {selected?.reviewer ? <span>Reviewer: {selected.reviewer}</span> : null}
            {selected ? <span>SLA {selected.slaDays} working days</span> : null}
          </>
        }
        actions={
          <Button variant="outline" onClick={() => navigate({ to: "/duplicates" })}>
            Duplicate detection <ArrowUpRight className="size-4" />
          </Button>
        }
      />

      <div className="grid gap-4 p-4 md:p-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-3">
          <Section bodyClassName="space-y-2 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cluster ID, national code, description"
                className="pl-8"
                aria-label="Search clusters"
              />
            </div>
            <div className="flex gap-2">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9" aria-label="Category filter">
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
              <Select
                value={statuses.length === 1 ? statuses[0]! : statuses.length === 0 ? "all" : "open"}
                onValueChange={(v) =>
                  setStatuses(v === "all" ? [] : v === "open" ? ["detected", "recommended", "under-review"] : [v])
                }
              >
                <SelectTrigger className="h-9" aria-label="Status filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open queue</SelectItem>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="detected">Detected</SelectItem>
                  <SelectItem value="recommended">Recommended</SelectItem>
                  <SelectItem value="under-review">Under review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Select
              value={matchTypes[0] ?? "all"}
              onValueChange={(v) => setMatchTypes(v === "all" ? [] : [v])}
            >
              <SelectTrigger className="h-9" aria-label="Match type filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All match categories</SelectItem>
                <SelectItem value="exact-match">Exact match</SelectItem>
                <SelectItem value="near-duplicate">Near duplicate</SelectItem>
                <SelectItem value="functional-equivalent">Functional equivalent</SelectItem>
                <SelectItem value="potential-conflict">Potential conflict</SelectItem>
              </SelectContent>
            </Select>
          </Section>

          <Section title="Candidate clusters" bodyClassName="p-0">
            {isLoading ? (
              <TableSkeleton rows={7} cols={2} />
            ) : isError ? (
              <ErrorState message="Unable to load the matching queue." onRetry={() => refetch()} />
            ) : list.length === 0 ? (
              <EmptyState
                title="No clusters for the selected filters"
                description="Widen the status or match category filters to see more candidates."
              />
            ) : (
              <ScrollArea className="h-[620px]">
                <ul className="divide-y divide-border">
                  {list.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(c.id)}
                        className={`w-full px-3 py-2.5 text-left transition-colors hover:bg-surface ${
                          selected?.id === c.id ? "bg-accent/50 shadow-[inset_2px_0_0_0_var(--primary)]" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="code-token">{c.id}</span>
                          <ConfidenceBadge value={c.similarity} />
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-foreground">
                          {c.recommendation.standardDescription}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <MatchTypeBadge type={c.matchType} />
                          <StatusBadge status={c.status} />
                          <span className="text-[11px] text-muted-foreground">
                            {c.memberIds.length} records · {relTime(c.detectedOn)}
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </Section>
        </div>

        {!selected ? (
          <Section>
            <EmptyState title="Select a cluster to begin validation" description="Candidate clusters are listed on the left." />
          </Section>
        ) : (
          <div className="space-y-4">
            <Section
              title={`Candidate match · ${selected.id}`}
              description={`${selected.category} · detected ${fmtDateTime(selected.detectedOn)}`}
              actions={
                <div className="flex items-center gap-2">
                  <MatchTypeBadge type={selected.matchType} />
                  <StatusBadge status={selected.status} />
                </div>
              }
            >
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {members.map((m, i) => (
                  <article key={m.id} className="rounded-md border border-border bg-surface p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Material {String.fromCharCode(65 + i)}
                      </span>
                      <ConfidenceBadge value={m.confidence} />
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-foreground">{cpseName(m.cpseId)}</p>
                    <p className="code-token mt-0.5">{m.cpseCode}</p>
                    <p className="mt-2 text-sm text-foreground">{m.description}</p>
                    <dl className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                      <div className="flex justify-between gap-2">
                        <dt>UOM</dt>
                        <dd className="text-foreground">{m.uom}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>Manufacturer</dt>
                        <dd className="text-foreground">{m.manufacturer}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>Data quality</dt>
                        <dd className="text-foreground">{m.dataQuality}%</dd>
                      </div>
                    </dl>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-7 px-1.5 text-xs"
                      onClick={() => navigate({ to: "/materials/$id", params: { id: m.id } })}
                    >
                      View source record
                    </Button>
                  </article>
                ))}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  { label: "Overall similarity", value: selected.similarity },
                  { label: "Description similarity", value: selected.descriptionSimilarity },
                  { label: "Specification similarity", value: selected.specificationSimilarity },
                  { label: "Attribute overlap", value: selected.attributeOverlap },
                  { label: "Classification similarity", value: selected.classificationSimilarity },
                ].map((s) => (
                  <div key={s.label} className="rounded-md border border-border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
                    <p className="numeric mt-1 text-lg font-semibold">{s.value.toFixed(1)}%</p>
                    <MetricBar value={s.value} tone={s.value >= 95 ? "success" : s.value >= 85 ? "info" : "warning"} />
                  </div>
                ))}
              </div>
            </Section>

            <ComparisonTable members={members} />

            <div className="grid gap-4 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <Section title="Equivalence analysis" description="Evidence supporting the recommendation">
                  <ul className="space-y-2">
                    {selected.recommendation.rationale.map((r, i) => (
                      <li key={i} className="flex gap-2 text-sm text-foreground">
                        <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                        {r}
                      </li>
                    ))}
                    <li className="flex gap-2 text-sm text-muted-foreground">
                      <ShieldQuestion className="mt-0.5 size-4 shrink-0" aria-hidden />
                      Unit compatibility:{" "}
                      {selected.uomCompatible
                        ? "member units are convertible to the canonical unit"
                        : "conversion factor required — flagged to governance"}
                    </li>
                  </ul>

                  <div className="mt-4 border-t border-border pt-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Review discussion ({selected.comments.length})</h3>
                      <Button variant="outline" size="sm" onClick={() => setCommentOpen(true)}>
                        <MessageSquare className="size-3.5" /> Add comment
                      </Button>
                    </div>
                    {selected.comments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No review comments recorded yet.</p>
                    ) : (
                      <ul className="space-y-3">
                        {selected.comments.map((c) => (
                          <li key={c.id} className="rounded-md border border-border bg-surface p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium">{c.author}</span>
                              <span className="text-[11px] text-muted-foreground">
                                {c.role} · {relTime(c.timestamp)}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">{c.body}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Section>
              </div>

              <Section title="Recommendation" description="Proposed common national material">
                <dl>
                  <DetailRow label="National code" value={selected.recommendation.nationalCode} mono />
                  <DetailRow label="Standard description" value={selected.recommendation.standardDescription} />
                  <DetailRow label="Category" value={selected.recommendation.category} />
                  <DetailRow label="Canonical UOM" value={selected.recommendation.uom} />
                  <DetailRow label="Recommendation confidence" value={<ConfidenceBadge value={selected.recommendation.confidence} />} />
                  <DetailRow label="Legacy codes to be mapped" value={`${members.length} CPSE codes`} />
                </dl>

                <div className="mt-4 space-y-2">
                  <Button
                    className="w-full"
                    disabled={!can("approve") || selected.status === "approved"}
                    onClick={() => setApproveOpen(true)}
                  >
                    <Check className="size-4" /> Accept recommendation
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" disabled={!can("edit")} onClick={() => setModifyOpen(true)}>
                      <Pencil className="size-4" /> Modify
                    </Button>
                    <Button variant="outline" disabled={!can("edit")} onClick={() => setReviewOpen(true)}>
                      <Send className="size-4" /> Send for review
                    </Button>
                  </div>
                  <Button
                    variant="destructive"
                    className="w-full"
                    disabled={!can("approve") || selected.status === "rejected"}
                    onClick={() => setRejectOpen(true)}
                  >
                    <X className="size-4" /> Reject
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full"
                    disabled={!can("edit")}
                    onClick={() => {
                      dispatch({
                        type: "cluster/status",
                        id: selected.id,
                        status: "kept-separate",
                        reason: "Materials confirmed distinct by reviewer",
                        actor,
                      });
                      toast.success(`${selected.id} marked as distinct materials`);
                    }}
                  >
                    <CircleSlash className="size-4" /> Keep separate
                  </Button>
                  {!can("approve") ? (
                    <p className="text-xs text-muted-foreground">
                      Role “{actor.role}” cannot approve. Switch role from the user menu to complete validation.
                    </p>
                  ) : null}
                </div>
              </Section>
            </div>
          </div>
        )}
      </div>

      {selected ? (
        <>
          <ReasonDialog
            open={approveOpen}
            onOpenChange={setApproveOpen}
            title="Approve harmonisation recommendation"
            description={`${selected.recommendation.nationalCode} will be activated and ${members.length} CPSE codes will be mapped to it.`}
            confirmLabel="Approve and map"
            defaultReason="Specification equivalence confirmed against member records"
            extra={
              <div className="rounded-md border border-border bg-surface p-3 text-sm">
                <p className="code-token">{selected.recommendation.nationalCode}</p>
                <p className="mt-1 text-foreground">{selected.recommendation.standardDescription}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Canonical UOM {selected.recommendation.uom} · confidence {selected.recommendation.confidence.toFixed(1)}%
                </p>
              </div>
            }
            onConfirm={async (reason) => {
              await matchingService.transition(selected.id, "approve");
              dispatch({ type: "cluster/approve", id: selected.id, reason, actor });
              toast.success(`${selected.recommendation.nationalCode} approved`, {
                description: `${members.length} legacy CPSE codes mapped · dashboard, mapping and audit updated.`,
              });
            }}
          />

          <ReasonDialog
            open={rejectOpen}
            onOpenChange={setRejectOpen}
            title="Reject recommendation"
            description="Member records will return to the unstandardised pool and the cluster will be closed as rejected."
            confirmLabel="Reject recommendation"
            destructive
            defaultReason="Attribute divergence — materials are not interchangeable"
            onConfirm={async (reason) => {
              await matchingService.transition(selected.id, "reject");
              dispatch({ type: "cluster/reject", id: selected.id, reason, actor });
              toast.success(`${selected.id} rejected`, { description: "Audit event recorded." });
            }}
          />

          <ModifyDialog
            open={modifyOpen}
            onOpenChange={setModifyOpen}
            cluster={selected}
            onSave={(overrides, reason) => {
              dispatch({ type: "cluster/approve", id: selected.id, reason, overrides, actor });
              toast.success("Recommendation modified and approved", {
                description: `${overrides.nationalCode ?? selected.recommendation.nationalCode} activated.`,
              });
            }}
          />

          <ReviewDialog
            open={reviewOpen}
            onOpenChange={setReviewOpen}
            onSubmit={(reviewer, note) => {
              dispatch({ type: "cluster/review", id: selected.id, reviewer, note, actor });
              toast.success(`Assigned to ${reviewer}`, { description: "Cluster moved to Under review." });
            }}
          />

          <CommentDialog
            open={commentOpen}
            onOpenChange={setCommentOpen}
            onSubmit={(body, kind) => {
              dispatch({ type: "cluster/comment", id: selected.id, body, kind, actor });
              toast.success(kind === "clarification" ? "Clarification requested" : "Comment added");
            }}
          />
        </>
      ) : null}
    </>
  );
}

function ComparisonTable({ members }: { members: Material[] }) {
  const { cpseName } = useNumm();
  const rows = useMemo(() => {
    const attrKeys = [...new Set(members.flatMap((m) => Object.keys(m.attributes)))];
    const base: { label: string; values: (string | undefined)[] }[] = [
      { label: "Description", values: members.map((m) => m.description) },
      { label: "Standard description", values: members.map((m) => m.standardDescription ?? undefined) },
      { label: "Category", values: members.map((m) => m.category) },
      { label: "Classification", values: members.map((m) => m.classificationPath.join(" › ")) },
      { label: "Specification", values: members.map((m) => m.specification) },
      { label: "Unit of measure", values: members.map((m) => m.uom) },
      { label: "Manufacturer", values: members.map((m) => m.manufacturer) },
    ];
    const attrRows = attrKeys.map((k) => ({ label: k, values: members.map((m) => m.attributes[k]) }));
    return [...base, ...attrRows];
  }, [members]);

  const summary = rows.reduce<Record<RowState, number>>(
    (acc, r) => {
      const s = rowState(r.values);
      acc[s] += 1;
      return acc;
    },
    { exact: 0, equivalent: 0, different: 0, missing: 0, review: 0 },
  );

  return (
    <Section
      title="Attribute comparison"
      description="Row-level equivalence analysis across member records"
      actions={
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {(Object.keys(summary) as RowState[]).map((k) => (
            <span key={k} className={ROW_STYLE[k].className}>
              {ROW_STYLE[k].label}: <span className="numeric font-semibold">{summary[k]}</span>
            </span>
          ))}
        </div>
      }
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-52">Attribute</TableHead>
              {members.map((m, i) => (
                <TableHead key={m.id}>
                  {String.fromCharCode(65 + i)} · {cpseName(m.cpseId)}
                  <span className="code-token block text-[11px] font-normal text-muted-foreground">{m.cpseCode}</span>
                </TableHead>
              ))}
              <TableHead className="w-40">Assessment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const s = rowState(r.values);
              return (
                <TableRow key={r.label} className="hover:bg-surface">
                  <TableCell className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {r.label}
                  </TableCell>
                  {r.values.map((v, i) => (
                    <TableCell key={i} className="text-sm">
                      {v ?? <span className="text-xs italic text-warning">not populated</span>}
                    </TableCell>
                  ))}
                  <TableCell>
                    <span className={`text-xs font-semibold uppercase tracking-wide ${ROW_STYLE[s].className}`}>
                      {ROW_STYLE[s].label}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Section>
  );
}

function ModifyDialog({
  open,
  onOpenChange,
  cluster,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cluster: DuplicateCluster;
  onSave: (overrides: { nationalCode: string; standardDescription: string; uom: string }, reason: string) => void;
}) {
  const [code, setCode] = useState(cluster.recommendation.nationalCode);
  const [desc, setDesc] = useState(cluster.recommendation.standardDescription);
  const [uom, setUom] = useState(cluster.recommendation.uom);
  const [reason, setReason] = useState("Reviewer amended standard description");

  useEffect(() => {
    setCode(cluster.recommendation.nationalCode);
    setDesc(cluster.recommendation.standardDescription);
    setUom(cluster.recommendation.uom);
  }, [cluster]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Modify recommendation</DialogTitle>
          <DialogDescription>
            Amend the proposed national code, standard description or canonical unit before approving.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="National material code">
            <Input value={code} onChange={(e) => setCode(e.target.value)} className="code-token" />
          </Field>
          <Field label="Standard description">
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
          </Field>
          <Field label="Canonical unit of measure">
            <Input value={uom} onChange={(e) => setUom(e.target.value)} />
          </Field>
          <Field label="Change reason (recorded in audit trail)">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!code.trim() || !desc.trim() || reason.trim().length < 4}
            onClick={() => {
              onSave({ nationalCode: code.trim(), standardDescription: desc.trim(), uom: uom.trim() }, reason.trim());
              onOpenChange(false);
            }}
          >
            Save and approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (reviewer: string, note: string) => void;
}) {
  const [reviewer, setReviewer] = useState(REVIEWERS[0]!);
  const [note, setNote] = useState("Engineering confirmation required on dimensional attributes.");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send for engineering review</DialogTitle>
          <DialogDescription>Assign a reviewer and record the clarification being sought.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Assign reviewer">
            <Select value={reviewer} onValueChange={setReviewer}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REVIEWERS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Review note">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSubmit(reviewer, note.trim());
              onOpenChange(false);
            }}
          >
            Assign reviewer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CommentDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (body: string, kind: "comment" | "clarification") => void;
}) {
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"comment" | "clarification">("comment");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add review note</DialogTitle>
          <DialogDescription>Comments are visible to all reviewers and recorded in the audit trail.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Note type">
            <Select value={kind} onValueChange={(v) => setKind(v as "comment" | "clarification")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comment">Review comment</SelectItem>
                <SelectItem value="clarification">Request clarification</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Note">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="e.g. Confirm bore diameter tolerance against OEM datasheet before approval."
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={body.trim().length < 4}
            onClick={() => {
              onSubmit(body.trim(), kind);
              setBody("");
              onOpenChange(false);
            }}
          >
            Save note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

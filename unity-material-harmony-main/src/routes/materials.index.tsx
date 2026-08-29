import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Eye,
  Filter,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  ConfidenceBadge,
  DetailRow,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  Section,
  StatusBadge,
  TableSkeleton,
  fmtDate,
  fmtInt,
} from "@/components/kit";
import { ReasonDialog } from "@/components/dialogs";
import { CATEGORIES, CPSES, UOMS } from "@/data/dataset";
import type { Material } from "@/data/types";
import { materialService, type MaterialQuery } from "@/services/api";
import { useNumm } from "@/store/numm-store";
import { downloadFile, toCsv } from "@/lib/export";

export const Route = createFileRoute("/materials/")({
  head: () => ({
    meta: [
      { title: "Material Master — NUMM" },
      {
        name: "description",
        content:
          "Unified searchable material master across CPSEs with national code, standard description, classification and match confidence.",
      },
      { property: "og:title", content: "NUMM Material Master registry" },
      {
        property: "og:description",
        content: "Search, filter and govern CPSE material records mapped to common national material codes.",
      },
    ],
  }),
  component: MaterialMaster,
});

const ALL_COLUMNS = [
  { key: "nationalCode", label: "National code" },
  { key: "cpseId", label: "CPSE" },
  { key: "cpseCode", label: "CPSE material code" },
  { key: "description", label: "Material description" },
  { key: "standardDescription", label: "Standard description" },
  { key: "category", label: "Category" },
  { key: "specification", label: "Specification" },
  { key: "uom", label: "UOM" },
  { key: "status", label: "Status" },
  { key: "confidence", label: "Match confidence" },
  { key: "lastUpdated", label: "Last updated" },
  { key: "approvalStatus", label: "Approval" },
] as const;

type ColKey = (typeof ALL_COLUMNS)[number]["key"];

const STATUSES = ["unstandardized", "standardized", "duplicate-candidate", "under-review", "mapped"];
const APPROVALS = ["not-submitted", "pending", "approved", "rejected"];

function MaterialMaster() {
  const { state, dispatch, actor, cpseName, can } = useNumm();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [cpseIds, setCpseIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [approval, setApproval] = useState<string[]>([]);
  const [uoms, setUoms] = useState<string[]>([]);
  const [minConfidence, setMinConfidence] = useState(0);
  const [sortBy, setSortBy] = useState<keyof Material>("cpseCode");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [hidden, setHidden] = useState<ColKey[]>(["specification"]);
  const [selected, setSelected] = useState<string[]>([]);
  const [quickView, setQuickView] = useState<Material | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const scoped = useMemo(
    () => (state.activeCpse === "ALL" ? state.materials : state.materials.filter((m) => m.cpseId === state.activeCpse)),
    [state.materials, state.activeCpse],
  );

  const query: MaterialQuery = {
    search,
    cpseIds,
    categories,
    statuses,
    approval,
    uoms,
    minConfidence,
    sortBy,
    sortDir,
    page,
    pageSize,
  };

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["materials", query, scoped.length, state.sessionActions, state.activeCpse],
    queryFn: () => materialService.list(scoped, query),
  });

  const columns = ALL_COLUMNS.filter((c) => !hidden.includes(c.key));
  const rows = data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));
  const activeFilters =
    cpseIds.length + categories.length + statuses.length + approval.length + uoms.length + (minConfidence ? 1 : 0);

  const resetFilters = () => {
    setSearch("");
    setCpseIds([]);
    setCategories([]);
    setStatuses([]);
    setApproval([]);
    setUoms([]);
    setMinConfidence(0);
    setPage(1);
    toast.info("Filters cleared");
  };

  const toggleSort = (key: ColKey) => {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key as keyof Material);
      setSortDir("asc");
    }
  };

  const exportCsv = () => {
    const source = selected.length ? scoped.filter((m) => selected.includes(m.id)) : rows;
    downloadFile(
      `numm-material-master-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        source.map((m) => ({ ...m, attributes: Object.entries(m.attributes).map(([k, v]) => `${k}=${v}`).join("; ") })),
        [
          { key: "nationalCode", label: "National Code" },
          { key: "cpseId", label: "CPSE" },
          { key: "cpseCode", label: "CPSE Material Code" },
          { key: "description", label: "Material Description" },
          { key: "standardDescription", label: "Standard Description" },
          { key: "category", label: "Category" },
          { key: "specification", label: "Specification" },
          { key: "uom", label: "UOM" },
          { key: "status", label: "Status" },
          { key: "confidence", label: "Match Confidence" },
          { key: "approvalStatus", label: "Approval Status" },
          { key: "attributes", label: "Technical Attributes" },
        ] as never,
      ),
    );
    toast.success(`Exported ${source.length} records`, { description: "CSV generated from the current result set." });
  };

  const cell = (m: Material, key: ColKey) => {
    switch (key) {
      case "nationalCode":
        return m.nationalCode ? (
          <span className="code-token text-foreground">{m.nationalCode}</span>
        ) : (
          <span className="text-xs text-muted-foreground">Not assigned</span>
        );
      case "cpseId":
        return <span className="whitespace-nowrap">{cpseName(m.cpseId)}</span>;
      case "cpseCode":
        return <span className="code-token">{m.cpseCode}</span>;
      case "description":
        return (
          <Link to="/materials/$id" params={{ id: m.id }} className="block max-w-[280px] truncate hover:underline" title={m.description}>
            {m.description}
          </Link>
        );
      case "standardDescription":
        return m.standardDescription ? (
          <span className="block max-w-[280px] truncate" title={m.standardDescription}>
            {m.standardDescription}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Pending standardisation</span>
        );
      case "specification":
        return <span className="block max-w-[200px] truncate text-muted-foreground">{m.specification}</span>;
      case "status":
        return <StatusBadge status={m.status} />;
      case "approvalStatus":
        return <StatusBadge status={m.approvalStatus} />;
      case "confidence":
        return <ConfidenceBadge value={m.confidence} />;
      case "lastUpdated":
        return <span className="whitespace-nowrap text-muted-foreground">{fmtDate(m.lastUpdated)}</span>;
      default:
        return <span>{String(m[key as keyof Material] ?? "—")}</span>;
    }
  };

  return (
    <>
      <PageHeader
        title="Material master"
        description="Unified registry of CPSE material records with standardised descriptions, national codes and match evidence."
        breadcrumb={[{ label: "NUMM", to: "/" }, { label: "Material Master" }]}
        meta={
          <>
            <span>{fmtInt(data?.total ?? 0)} records in current result set</span>
            <span>{fmtInt(scoped.length)} records in scope</span>
            {selected.length ? <span className="text-foreground">{selected.length} selected</span> : null}
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={exportCsv}>
              <Download className="size-4" /> Export
            </Button>
            <Button variant="outline" onClick={() => navigate({ to: "/standardization" })}>
              <SlidersHorizontal className="size-4" /> Standardize
            </Button>
            <Button onClick={() => navigate({ to: "/harmonize" })}>Match & harmonize</Button>
          </>
        }
      />

      <div className="space-y-4 p-4 md:p-6">
        <Section bodyClassName="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[260px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search code, description, specification, manufacturer…"
                className="pl-8"
                aria-label="Search material records"
              />
            </div>

            <MultiFilter label="CPSE" options={CPSES.map((c) => ({ value: c.id, label: c.shortName }))} value={cpseIds} onChange={(v) => { setCpseIds(v); setPage(1); }} />
            <MultiFilter label="Category" options={CATEGORIES.map((c) => ({ value: c, label: c }))} value={categories} onChange={(v) => { setCategories(v); setPage(1); }} />
            <MultiFilter label="Status" options={STATUSES.map((s) => ({ value: s, label: s.replace(/-/g, " ") }))} value={statuses} onChange={(v) => { setStatuses(v); setPage(1); }} />
            <MultiFilter label="Approval" options={APPROVALS.map((s) => ({ value: s, label: s.replace(/-/g, " ") }))} value={approval} onChange={(v) => { setApproval(v); setPage(1); }} />
            <MultiFilter label="UOM" options={UOMS.map((u) => ({ value: u, label: u }))} value={uoms} onChange={(v) => { setUoms(v); setPage(1); }} />

            <Select value={String(minConfidence)} onValueChange={(v) => { setMinConfidence(Number(v)); setPage(1); }}>
              <SelectTrigger className="h-9 w-[168px]" aria-label="Minimum match confidence">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Any confidence</SelectItem>
                <SelectItem value="80">≥ 80% confidence</SelectItem>
                <SelectItem value="88">≥ 88% confidence</SelectItem>
                <SelectItem value="95">≥ 95% confidence</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <Columns3 className="size-4" /> Columns
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-60">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Visible columns</p>
                <div className="space-y-1.5">
                  {ALL_COLUMNS.map((c) => (
                    <label key={c.key} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={!hidden.includes(c.key)}
                        onCheckedChange={(v) =>
                          setHidden((h) => (v ? h.filter((k) => k !== c.key) : [...h, c.key]))
                        }
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {activeFilters || search ? (
              <Button variant="ghost" size="sm" className="h-9" onClick={resetFilters}>
                <RotateCcw className="size-3.5" /> Clear ({activeFilters + (search ? 1 : 0)})
              </Button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Filter className="size-3.5" /> No filters applied
              </span>
            )}
          </div>

          {selected.length > 0 ? (
            <>
              <Separator className="my-3" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{selected.length} record(s) selected</span>
                <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)} disabled={!can("edit")}>
                  Send for review
                </Button>
                <Button size="sm" variant="outline" onClick={exportCsv}>
                  <Download className="size-3.5" /> Export selection
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
                  Clear selection
                </Button>
                {!can("edit") ? (
                  <span className="text-xs text-muted-foreground">Current role has read-only access.</span>
                ) : null}
              </div>
            </>
          ) : null}
        </Section>

        <Section bodyClassName="p-0">
          {isLoading ? (
            <TableSkeleton rows={10} cols={columns.length} />
          ) : isError ? (
            <ErrorState message="Unable to load the material registry." onRetry={() => refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No material records match the current filters"
              description="Adjust the search terms or clear filters to widen the result set."
              action={
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-9">
                        <Checkbox
                          aria-label="Select all rows on this page"
                          checked={rows.every((r) => selected.includes(r.id))}
                          onCheckedChange={(v) =>
                            setSelected((s) =>
                              v
                                ? [...new Set([...s, ...rows.map((r) => r.id)])]
                                : s.filter((id) => !rows.some((r) => r.id === id)),
                            )
                          }
                        />
                      </TableHead>
                      {columns.map((c) => (
                        <TableHead key={c.key}>
                          <button
                            type="button"
                            onClick={() => toggleSort(c.key)}
                            className="inline-flex items-center gap-1 hover:text-foreground"
                          >
                            {c.label}
                            <ArrowUpDown className={`size-3 ${sortBy === c.key ? "text-foreground" : "text-muted-foreground/50"}`} />
                          </button>
                        </TableHead>
                      ))}
                      <TableHead className="w-16 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((m) => (
                      <TableRow key={m.id} className="hover:bg-surface">
                        <TableCell>
                          <Checkbox
                            aria-label={`Select ${m.cpseCode}`}
                            checked={selected.includes(m.id)}
                            onCheckedChange={(v) =>
                              setSelected((s) => (v ? [...s, m.id] : s.filter((id) => id !== m.id)))
                            }
                          />
                        </TableCell>
                        {columns.map((c) => (
                          <TableCell key={c.key} className="align-middle text-sm">
                            {cell(m, c.key)}
                          </TableCell>
                        ))}
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" aria-label={`Quick view ${m.cpseCode}`} onClick={() => setQuickView(m)}>
                            <Eye className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>
                    Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, data?.total ?? 0)} of{" "}
                    {fmtInt(data?.total ?? 0)}
                  </span>
                  {isFetching ? <span className="text-xs">· refreshing…</span> : null}
                </div>
                <div className="flex items-center gap-2">
                  <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                    <SelectTrigger className="h-8 w-[110px]" aria-label="Rows per page">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 25, 50, 100].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} / page
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" className="size-8" disabled={page === 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="numeric text-sm">
                    Page {page} of {totalPages}
                  </span>
                  <Button variant="outline" size="icon" className="size-8" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Section>
      </div>

      <Sheet open={!!quickView} onOpenChange={(v) => !v && setQuickView(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {quickView ? (
            <>
              <SheetHeader>
                <SheetTitle className="code-token text-base">{quickView.cpseCode}</SheetTitle>
                <SheetDescription>
                  {cpseName(quickView.cpseId)} · {quickView.category} · {quickView.source}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-6">
                <dl>
                  <DetailRow label="National material code" value={quickView.nationalCode ?? "Not assigned"} mono />
                  <DetailRow label="Material description" value={quickView.description} />
                  <DetailRow label="Standard description" value={quickView.standardDescription ?? "Pending standardisation"} />
                  <DetailRow label="Classification" value={quickView.classificationPath.join(" › ")} />
                  <DetailRow label="UOM" value={quickView.uom} />
                  <DetailRow label="Status" value={<StatusBadge status={quickView.status} />} />
                  <DetailRow label="Match confidence" value={<ConfidenceBadge value={quickView.confidence} />} />
                  <DetailRow label="Data quality" value={`${quickView.dataQuality}%`} />
                  <DetailRow label="Lifecycle" value={`${quickView.lifecycle} · ${quickView.version}`} />
                </dl>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      const id = quickView.id;
                      setQuickView(null);
                      navigate({ to: "/materials/$id", params: { id } });
                    }}
                  >
                    Open full profile
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate({ to: "/standardization", search: { material: quickView.id } })}>
                    Standardize
                  </Button>
                  {quickView.clusterId ? (
                    <Button size="sm" variant="outline" onClick={() => navigate({ to: "/harmonize", search: { cluster: quickView.clusterId! } })}>
                      Open cluster {quickView.clusterId}
                    </Button>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <ReasonDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title={`Send ${selected.length} record(s) for review`}
        description="Selected records will move to Under review and appear in the reviewer queue."
        confirmLabel="Send for review"
        defaultReason="Bulk standardisation review"
        onConfirm={async (reason) => {
          dispatch({ type: "material/bulkStatus", ids: selected, status: "under-review", reason, actor });
          toast.success(`${selected.length} records sent for review`, { description: "Audit events recorded." });
          setSelected([]);
        }}
      />
    </>
  );
}

function MultiFilter({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9">
          {label}
          {value.length ? <span className="numeric ml-1 rounded-sm bg-secondary px-1 text-[11px]">{value.length}</span> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-72 w-56 overflow-y-auto">
        <Field label={label}>
          <div className="space-y-1.5">
            {options.map((o) => (
              <label key={o.value} className="flex items-center gap-2 text-sm capitalize">
                <Checkbox
                  checked={value.includes(o.value)}
                  onCheckedChange={(v) => onChange(v ? [...value, o.value] : value.filter((x) => x !== o.value))}
                />
                {o.label}
              </label>
            ))}
          </div>
        </Field>
        {value.length ? (
          <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => onChange([])}>
            Clear
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

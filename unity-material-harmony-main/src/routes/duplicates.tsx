import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Scan } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CHART_COLORS,
  ConfidenceBadge,
  EmptyState,
  KpiCard,
  MATCH_LABELS,
  MatchTypeBadge,
  PageHeader,
  Section,
  StatusBadge,
  fmtInt,
  relTime,
} from "@/components/kit";
import { ReasonDialog } from "@/components/dialogs";
import { duplicateService } from "@/services/api";
import { useNumm } from "@/store/numm-store";
import { downloadFile, toCsv } from "@/lib/export";
import type { DuplicateCluster, MatchType } from "@/data/types";

export const Route = createFileRoute("/duplicates")({
  head: () => ({
    meta: [
      { title: "Duplicate & Near-Duplicate Detection — NUMM" },
      {
        name: "description",
        content:
          "Run similarity scans across CPSE material masters and triage exact duplicates, near duplicates and functional equivalents.",
      },
      { property: "og:title", content: "NUMM duplicate detection" },
      {
        property: "og:description",
        content: "Similarity scanning, threshold tuning and cluster triage for CPSE material data.",
      },
    ],
  }),
  component: Duplicates,
});

const MATCH_TYPES: MatchType[] = ["exact-match", "near-duplicate", "functional-equivalent", "potential-conflict"];

function Duplicates() {
  const navigate = useNavigate();
  const { state, dispatch, actor, metrics, can, cpseName } = useNumm();

  const [threshold, setThreshold] = useState(85);
  const [matchType, setMatchType] = useState("all");
  const [search, setSearch] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanPct, setScanPct] = useState(0);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [dismissTarget, setDismissTarget] = useState<DuplicateCluster | null>(null);

  const openClusters = state.clusters.filter((c) => ["detected", "recommended", "under-review"].includes(c.status));

  const rows = useMemo(() => {
    const t = search.trim().toLowerCase();
    return state.clusters
      .filter((c) => c.similarity >= threshold)
      .filter((c) => matchType === "all" || c.matchType === matchType)
      .filter(
        (c) =>
          !t ||
          c.id.toLowerCase().includes(t) ||
          c.recommendation.standardDescription.toLowerCase().includes(t) ||
          c.category.toLowerCase().includes(t),
      )
      .sort((a, b) => b.similarity - a.similarity);
  }, [state.clusters, threshold, matchType, search]);

  const byType = MATCH_TYPES.map((t) => ({
    name: MATCH_LABELS[t],
    value: state.clusters.filter((c) => c.matchType === t).length,
  }));

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    state.clusters.forEach((c) => map.set(c.category, (map.get(c.category) ?? 0) + c.memberIds.length - 1));
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [state.clusters]);

  async function runScan() {
    setScanning(true);
    setScanPct(6);
    const timer = setInterval(() => setScanPct((p) => Math.min(94, p + Math.round(4 + Math.random() * 9))), 160);
    const result = await duplicateService.scan();
    clearInterval(timer);
    setScanPct(100);
    setScanning(false);
    setLastScan(result.at);
    dispatch({
      type: "audit",
      event: {
        user: actor.name,
        role: actor.role,
        action: "Similarity scan executed",
        entity: "Duplicate detection engine",
        previousValue: "—",
        newValue: `${result.clustersFound} clusters over ${fmtInt(result.scanned)} records`,
        reason: `Threshold ${threshold}%`,
        status: "info",
      },
    });
    dispatch({
      type: "notify",
      notification: {
        title: "Similarity scan complete",
        body: `${result.clustersFound} candidate clusters identified across ${fmtInt(result.scanned)} sampled records.`,
        kind: "duplicate",
        link: "/duplicates",
      },
    });
    toast.success("Scan complete", {
      description: `${result.clustersFound} clusters found · threshold ${threshold}%`,
    });
  }

  function exportCsv() {
    const csv = toCsv(
      rows.map((c) => ({
        cluster: c.id,
        category: c.category,
        matchType: MATCH_LABELS[c.matchType],
        members: c.memberIds.length,
        similarity: c.similarity.toFixed(1),
        status: c.status,
        recommendedCode: c.recommendation.nationalCode,
        recommendation: c.recommendation.standardDescription,
      })),
      [
        { key: "cluster", label: "Cluster ID" },
        { key: "category", label: "Category" },
        { key: "matchType", label: "Match type" },
        { key: "members", label: "Member records" },
        { key: "similarity", label: "Similarity %" },
        { key: "status", label: "Status" },
        { key: "recommendedCode", label: "Recommended national code" },
        { key: "recommendation", label: "Standard description" },
      ],
    );
    downloadFile(`numm-duplicate-clusters-${Date.now()}.csv`, csv);
    toast.success(`Exported ${rows.length} clusters`);
  }

  return (
    <>
      <PageHeader
        title="Duplicate & near-duplicate detection"
        description="Similarity scoring across description, specification, attributes and classification identifies redundant material records between CPSEs."
        breadcrumb={[{ label: "NUMM", to: "/" }, { label: "Duplicate Detection" }]}
        meta={
          <>
            <span>{fmtInt(state.clusters.length)} clusters in engine</span>
            <span>{fmtInt(openClusters.length)} awaiting triage</span>
            <span>Last scan: {lastScan ? relTime(lastScan) : "today, 06:15"}</span>
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="size-4" /> Export
            </Button>
            <Button onClick={runScan} disabled={scanning}>
              <Scan className="size-4" /> {scanning ? "Scanning…" : "Run similarity scan"}
            </Button>
          </>
        }
      />

      <div className="space-y-4 p-4 md:p-6">
        {scanning || scanPct === 100 ? (
          <Section title="Detection engine" description="Vector similarity + attribute rule pass over the sampled corpus">
            <Progress value={scanPct} />
            <p className="mt-2 text-sm text-muted-foreground">
              {scanning
                ? `Comparing records… ${scanPct}% complete`
                : "Scan complete — clusters below reflect the latest pass."}
            </p>
          </Section>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Duplicate candidates" value={fmtInt(metrics.projection.duplicateCandidates)} sub="Records inside open clusters" />
          <KpiCard label="Clusters awaiting triage" value={fmtInt(openClusters.length)} sub="Detected, recommended or under review" />
          <KpiCard label="Rationalisation potential" value={fmtInt(metrics.rationalisation)} sub="Codes removable on approval" />
          <KpiCard label="Approved harmonisations" value={fmtInt(metrics.approvedClusters)} sub="Clusters resolved this session" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Clusters by match category">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byType} dataKey="value" nameKey="name" innerRadius={54} outerRadius={90} paddingAngle={2}>
                    {byType.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <ReTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
              {byType.map((d, i) => (
                <li key={d.name} className="flex items-center gap-2 text-muted-foreground">
                  <span className="size-2.5 rounded-sm" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                  {d.name}
                  <span className="numeric ml-auto font-semibold text-foreground">{d.value}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Redundant codes by category" description="Codes eliminated if all clusters are approved">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCategory} layout="vertical" margin={{ left: 24, right: 12 }}>
                  <CartesianGrid horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis type="category" dataKey="name" width={130} stroke="var(--muted-foreground)" fontSize={11} />
                  <ReTooltip />
                  <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </div>

        <Section
          title="Candidate clusters"
          description={`${rows.length} clusters at or above ${threshold}% similarity`}
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex w-56 items-center gap-2">
                <span className="whitespace-nowrap text-xs text-muted-foreground">Threshold</span>
                <Slider
                  value={[threshold]}
                  min={60}
                  max={99}
                  step={1}
                  onValueChange={(v) => setThreshold(v[0] ?? 85)}
                  aria-label="Similarity threshold"
                />
                <span className="numeric w-9 text-xs font-semibold">{threshold}%</span>
              </div>
              <Select value={matchType} onValueChange={setMatchType}>
                <SelectTrigger className="h-9 w-48" aria-label="Match category filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All match categories</SelectItem>
                  {MATCH_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {MATCH_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search clusters"
                className="h-9 w-52"
                aria-label="Search clusters"
              />
            </div>
          }
          bodyClassName="p-0"
        >
          {rows.length === 0 ? (
            <EmptyState
              title="No clusters above the selected threshold"
              description="Lower the similarity threshold or clear the match category filter."
              action={<Button variant="outline" onClick={() => setThreshold(60)}>Lower threshold to 60%</Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cluster</TableHead>
                    <TableHead>Recommended standard description</TableHead>
                    <TableHead>CPSEs involved</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead className="text-right">Similarity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 60).map((c) => {
                    const cpses = [
                      ...new Set(
                        state.materials.filter((m) => c.memberIds.includes(m.id)).map((m) => cpseName(m.cpseId)),
                      ),
                    ];
                    return (
                      <TableRow key={c.id} className="hover:bg-surface">
                        <TableCell>
                          <span className="code-token">{c.id}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {c.memberIds.length} records · {c.category}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[320px] text-sm">{c.recommendation.standardDescription}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{cpses.join(", ")}</TableCell>
                        <TableCell>
                          <MatchTypeBadge type={c.matchType} />
                        </TableCell>
                        <TableCell className="text-right">
                          <ConfidenceBadge value={c.similarity} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={c.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate({ to: "/harmonize", search: { cluster: c.id } })}
                            >
                              Review
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={!can("edit") || c.status === "dismissed"}
                              onClick={() => setDismissTarget(c)}
                            >
                              Dismiss
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Section>
      </div>

      <ReasonDialog
        open={Boolean(dismissTarget)}
        onOpenChange={(v) => !v && setDismissTarget(null)}
        title="Dismiss candidate cluster"
        description="The cluster will be closed as a false positive and excluded from the triage queue."
        confirmLabel="Dismiss cluster"
        destructive
        defaultReason="False positive — materials are functionally distinct"
        onConfirm={(reason) => {
          if (!dismissTarget) return;
          dispatch({ type: "cluster/status", id: dismissTarget.id, status: "dismissed", reason, actor });
          toast.success(`${dismissTarget.id} dismissed`);
          setDismissTarget(null);
        }}
      />
    </>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, Copy, GitCompareArrows, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CHART_COLORS,
  ChartCard,
  ConfidenceBadge,
  KpiCard,
  MatchTypeBadge,
  MetricBar,
  PageHeader,
  Section,
  StatusBadge,
  fmtInt,
  fmtPct,
  relTime,
} from "@/components/kit";
import { CPSES } from "@/data/dataset";
import { useNumm } from "@/store/numm-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — NUMM National Unified Material Master" },
      {
        name: "description",
        content:
          "National harmonisation posture across connected CPSEs: duplicate exposure, standardisation coverage, mapping progress and pending validations.",
      },
      { property: "og:title", content: "NUMM Overview — National Material Master governance" },
      {
        property: "og:description",
        content: "Duplicate exposure, standardisation coverage and mapping progress across 12 connected CPSEs.",
      },
    ],
  }),
  component: Overview,
});

function Overview() {
  const { state, metrics, cpseName } = useNumm();
  const navigate = useNavigate();

  const cpseRows = useMemo(
    () =>
      CPSES.map((c) => {
        const rows = state.materials.filter((m) => m.cpseId === c.id);
        const dup = rows.filter((m) => m.status === "duplicate-candidate").length;
        const std = rows.filter((m) => m.standardDescription).length;
        const mapped = rows.filter((m) => m.nationalCode).length;
        return {
          cpse: c.shortName,
          sector: c.sector,
          total: rows.length,
          duplicatePct: rows.length ? (dup / rows.length) * 100 : 0,
          standardPct: rows.length ? (std / rows.length) * 100 : 0,
          mappedPct: rows.length ? (mapped / rows.length) * 100 : 0,
        };
      }).sort((a, b) => b.total - a.total),
    [state.materials],
  );

  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    state.materials.forEach((m) => map.set(m.category, (map.get(m.category) ?? 0) + 1));
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [state.materials]);

  const queue = useMemo(() => {
    const open = state.clusters.filter((c) => ["detected", "recommended", "under-review"].includes(c.status));
    return [
      { band: "High confidence (≥95%)", count: open.filter((c) => c.similarity >= 95).length, tone: "success" as const },
      { band: "Medium (88–95%)", count: open.filter((c) => c.similarity >= 88 && c.similarity < 95).length, tone: "info" as const },
      { band: "Low (80–88%)", count: open.filter((c) => c.similarity >= 80 && c.similarity < 88).length, tone: "warning" as const },
      {
        band: "Requires engineering review",
        count: open.filter((c) => c.similarity < 80 || c.matchType === "potential-conflict").length,
        tone: "critical" as const,
      },
    ];
  }, [state.clusters]);

  const priority = useMemo(
    () =>
      [...state.clusters]
        .filter((c) => ["detected", "recommended", "under-review"].includes(c.status))
        .sort((a, b) => b.memberIds.length * b.similarity - a.memberIds.length * a.similarity)
        .slice(0, 8),
    [state.clusters],
  );

  const dupReduction = useMemo(
    () =>
      categoryData.slice(0, 6).map((c) => {
        const rows = state.materials.filter((m) => m.category === c.name);
        const before = rows.length;
        const after = new Set(rows.map((m) => m.nationalCode ?? m.id)).size;
        return { category: c.name, before, after };
      }),
    [categoryData, state.materials],
  );

  return (
    <>
      <PageHeader
        title="National harmonisation overview"
        description="Consolidated posture of material master harmonisation across connected CPSEs. Figures reflect the prototype registry and the national projection model."
        breadcrumb={[{ label: "NUMM" }, { label: "Overview" }]}
        meta={
          <>
            <span>Scope: {state.activeCpse === "ALL" ? "All CPSEs (National view)" : cpseName(state.activeCpse)}</span>
            <span>Registry sample: {fmtInt(metrics.sampleTotal)} records · {metrics.connectedCpses} CPSEs</span>
            <span>Last synchronisation {relTime(state.integrations[0]!.lastSync)}</span>
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => navigate({ to: "/duplicates" })}>
              <Copy className="size-4" /> Duplicate clusters
            </Button>
            <Button onClick={() => navigate({ to: "/harmonize" })}>
              <GitCompareArrows className="size-4" /> Open review workspace
            </Button>
          </>
        }
      />

      <div className="space-y-4 p-4 md:p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <KpiCard
            label="Total materials"
            value={fmtInt(metrics.projection.totalMaterials)}
            sub={`${fmtInt(metrics.scopedCount)} in prototype registry`}
          />
          <KpiCard
            label="Standardized"
            value={fmtInt(metrics.projection.standardized)}
            sub={fmtPct((metrics.projection.standardized / metrics.projection.totalMaterials) * 100)}
            tone="success"
            trend={{ value: "+1.4% MoM", direction: "up" }}
          />
          <KpiCard
            label="Duplicate candidates"
            value={fmtInt(metrics.projection.duplicateCandidates)}
            sub={`${metrics.clusters} clusters in registry`}
            tone="critical"
            trend={{ value: "-2.1% MoM", direction: "down" }}
            onClick={() => navigate({ to: "/duplicates" })}
          />
          <KpiCard
            label="Pending review"
            value={fmtInt(metrics.projection.pendingReview)}
            sub={`${metrics.pendingReview} clusters awaiting validation`}
            tone="warning"
            onClick={() => navigate({ to: "/harmonize" })}
          />
          <KpiCard
            label="Mapped to national codes"
            value={fmtInt(metrics.projection.mappedToNational)}
            sub={`${fmtInt(metrics.activeMappings)} active mappings`}
            tone="info"
            onClick={() => navigate({ to: "/mapping" })}
          />
          <KpiCard
            label="Rationalisation opportunity"
            value={`₹${fmtInt(metrics.projection.rationalisationValue)} Cr`}
            sub={`${fmtInt(metrics.rationalisation)} redundant codes in registry`}
            tone="neutral"
            onClick={() => navigate({ to: "/analytics" })}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <ChartCard
              title="Material harmonisation trend"
              description="Monthly ingestion, matching, standardisation and approval volumes (records)"
              footer="Source: NUMM harmonisation pipeline · rolling 12 months"
            >
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={state.trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v) => `${v / 1000}k`} />
                  <RTooltip
                    contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid var(--border)" }}
                    formatter={(v: number) => fmtInt(v)}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="imported" name="Imported" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="matched" name="Matched" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="standardized" name="Standardized" stroke={CHART_COLORS[2]} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="approved" name="Approved" stroke={CHART_COLORS[3]} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <ChartCard
            title="Review queue by confidence band"
            description="Open harmonisation clusters awaiting human validation"
            footer={`${metrics.pendingReview} clusters open · SLA 7 working days`}
          >
            <ul className="space-y-3 p-1">
              {queue.map((q) => (
                <li key={q.band}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="text-sm text-foreground">{q.band}</span>
                    <span className="numeric text-sm font-semibold">{fmtInt(q.count)}</span>
                  </div>
                  <MetricBar
                    value={metrics.pendingReview ? (q.count / metrics.pendingReview) * 100 : 0}
                    tone={q.tone}
                  />
                </li>
              ))}
            </ul>
            <div className="mt-2 border-t border-border p-3">
              <Button variant="outline" size="sm" className="w-full" onClick={() => navigate({ to: "/harmonize" })}>
                Start validating <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </ChartCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <ChartCard
            title="Duplicate reduction by category"
            description="Distinct material records before and after harmonisation"
            footer="Registry sample; 'after' counts collapse mapped records to their national code"
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dupReduction} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" interval={0} angle={-12} dy={8} />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <RTooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="before" name="Before harmonisation" fill={CHART_COLORS[4]} radius={[2, 2, 0, 0]} />
                <Bar dataKey="after" name="After harmonisation" fill={CHART_COLORS[2]} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Material category distribution"
            description="Share of registry records by material category"
            footer={`${categoryData.length} categories · ${fmtInt(metrics.sampleTotal)} records`}
          >
            <div className="flex flex-col items-center gap-3 lg:flex-row">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={1}>
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <RTooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} formatter={(v: number) => `${fmtInt(v)} records`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        <Section
          title="CPSE material distribution"
          description="Comparative harmonisation posture per connected CPSE"
          actions={
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/analytics" })}>
              Detailed analytics
            </Button>
          }
          bodyClassName="p-0"
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CPSE</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead className="text-right">Materials</TableHead>
                  <TableHead className="w-44">Duplicate %</TableHead>
                  <TableHead className="w-44">Standardization %</TableHead>
                  <TableHead className="w-44">Mapped %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cpseRows.map((r) => (
                  <TableRow key={r.cpse}>
                    <TableCell className="font-medium">{r.cpse}</TableCell>
                    <TableCell className="text-muted-foreground">{r.sector}</TableCell>
                    <TableCell className="numeric text-right">{fmtInt(r.total)}</TableCell>
                    <TableCell>
                      <MetricBar value={r.duplicatePct} tone="critical" label={fmtPct(r.duplicatePct, 0)} />
                    </TableCell>
                    <TableCell>
                      <MetricBar value={r.standardPct} tone="info" label={fmtPct(r.standardPct, 0)} />
                    </TableCell>
                    <TableCell>
                      <MetricBar value={r.mappedPct} tone="success" label={fmtPct(r.mappedPct, 0)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Section>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <Section
              title="Priority harmonisation clusters"
              description="Highest-impact duplicate clusters awaiting validation"
              actions={
                <Button variant="outline" size="sm" onClick={() => navigate({ to: "/harmonize" })}>
                  Open workspace
                </Button>
              }
              bodyClassName="p-0"
            >
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cluster</TableHead>
                      <TableHead>Recommended national code</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Members</TableHead>
                      <TableHead>Match type</TableHead>
                      <TableHead>Similarity</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {priority.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="code-token">
                          <Link to="/harmonize" search={{ cluster: c.id }} className="hover:underline">
                            {c.id}
                          </Link>
                        </TableCell>
                        <TableCell className="code-token max-w-[240px] truncate" title={c.recommendation.nationalCode}>
                          {c.recommendation.nationalCode}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{c.category}</TableCell>
                        <TableCell className="numeric text-right">{c.memberIds.length}</TableCell>
                        <TableCell>
                          <MatchTypeBadge type={c.matchType} />
                        </TableCell>
                        <TableCell>
                          <ConfidenceBadge value={c.similarity} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={c.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Section>
          </div>

          <Section title="Governance exceptions" description="Open items requiring master-data intervention">
            <ul className="space-y-3">
              {state.governance
                .filter((g) => g.status !== "resolved")
                .slice(0, 5)
                .map((g) => (
                  <li key={g.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">{g.type}</span>
                      <StatusBadge status={g.severity} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{g.detail}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {g.entity} · {cpseName(g.cpseId)} · owner {g.owner}
                    </p>
                  </li>
                ))}
            </ul>
            <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => navigate({ to: "/governance" })}>
              <ShieldAlert className="size-3.5" /> Governance centre ({metrics.openGovernance})
            </Button>
          </Section>
        </div>
      </div>
    </>
  );
}

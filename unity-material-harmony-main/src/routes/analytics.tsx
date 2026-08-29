import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
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
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CHART_COLORS, KpiCard, MetricBar, PageHeader, Section, fmtCr, fmtInt, fmtPct } from "@/components/kit";
import { CPSES } from "@/data/dataset";
import { useNumm } from "@/store/numm-store";
import { downloadFile, toCsv } from "@/lib/export";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Rationalisation Analytics — NUMM" },
      {
        name: "description",
        content:
          "Cross-CPSE analytics on duplication density, standardisation progress, inventory rationalisation value and procurement consolidation.",
      },
      { property: "og:title", content: "NUMM rationalisation analytics" },
      {
        property: "og:description",
        content: "Duplication density, data quality and savings analytics across participating CPSEs.",
      },
    ],
  }),
  component: Analytics,
});

function Analytics() {
  const { state, metrics, cpseName } = useNumm();
  const [scope, setScope] = useState("all");

  const perCpse = useMemo(
    () =>
      CPSES.map((c) => {
        const mats = state.materials.filter((m) => m.cpseId === c.id);
        const standardized = mats.filter((m) => m.standardDescription).length;
        const mapped = mats.filter((m) => m.nationalCode).length;
        const dupes = mats.filter((m) => m.clusterId).length;
        const value = mats.reduce((a, m) => a + m.unitRate * m.stockQty, 0) / 1_00_00_000;
        return {
          id: c.id,
          name: c.shortName,
          erp: c.erp,
          sector: c.sector,
          records: mats.length,
          standardized,
          mapped,
          dupes,
          dq: mats.length ? Math.round(mats.reduce((a, m) => a + m.dataQuality, 0) / mats.length) : 0,
          inventory: Number(value.toFixed(1)),
          coverage: mats.length ? Math.round((standardized / mats.length) * 100) : 0,
        };
      }).sort((a, b) => b.records - a.records),
    [state.materials],
  );

  const scoped = scope === "all" ? perCpse : perCpse.filter((p) => p.id === scope);

  const categorySpread = useMemo(() => {
    const map = new Map<string, { name: string; records: number; duplicates: number }>();
    state.materials.forEach((m) => {
      const row = map.get(m.category) ?? { name: m.category, records: 0, duplicates: 0 };
      row.records += 1;
      if (m.clusterId) row.duplicates += 1;
      map.set(m.category, row);
    });
    return [...map.values()].sort((a, b) => b.records - a.records);
  }, [state.materials]);

  const savings = state.trend.map((t) => ({
    month: t.month,
    rationalised: t.approved * 4,
    standardised: t.standardized,
  }));

  const matchQuality = useMemo(() => {
    const buckets = [
      { name: "≥ 95%", min: 95 },
      { name: "90–95%", min: 90 },
      { name: "85–90%", min: 85 },
      { name: "< 85%", min: 0 },
    ];
    return buckets.map((b, i) => ({
      name: b.name,
      value: state.clusters.filter(
        (c) => c.similarity >= b.min && (i === 0 || c.similarity < (buckets[i - 1]?.min ?? 100)),
      ).length,
    }));
  }, [state.clusters]);

  function exportCsv() {
    const csv = toCsv(scoped, [
      { key: "name", label: "CPSE" },
      { key: "sector", label: "Sector" },
      { key: "erp", label: "ERP" },
      { key: "records", label: "Sampled records" },
      { key: "standardized", label: "Standardised" },
      { key: "mapped", label: "Mapped to national code" },
      { key: "dupes", label: "In duplicate clusters" },
      { key: "dq", label: "Avg data quality %" },
      { key: "inventory", label: "Inventory value (Cr)" },
    ]);
    downloadFile(`numm-analytics-${Date.now()}.csv`, csv);
    toast.success("Analytics exported");
  }

  return (
    <>
      <PageHeader
        title="Rationalisation analytics"
        description="Quantifies the duplication burden across CPSEs and the savings unlocked by a single national material master."
        breadcrumb={[{ label: "NUMM", to: "/" }, { label: "Analytics" }]}
        meta={
          <>
            <span>{fmtInt(metrics.projection.totalMaterials)} records in national scope</span>
            <span>{CPSES.length} CPSEs onboarded</span>
          </>
        }
        actions={
          <>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="h-9 w-44" aria-label="CPSE scope">
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
            <Button variant="outline" onClick={exportCsv}>
              <Download className="size-4" /> Export
            </Button>
          </>
        }
      />

      <div className="space-y-4 p-4 md:p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Rationalisation value"
            value={fmtCr(metrics.projection.rationalisationValue)}
            sub="Inventory carrying cost avoided"
            tone="success"
          />
          <KpiCard
            label="Duplicate records"
            value={fmtInt(metrics.projection.duplicateCandidates)}
            sub="Across all participating CPSEs"
            tone="warning"
          />
          <KpiCard
            label="Standardisation coverage"
            value={fmtPct((metrics.projection.standardized / metrics.projection.totalMaterials) * 100)}
            sub="Records on the national template"
            tone="info"
          />
          <KpiCard label="Average data quality" value={fmtPct(metrics.dataQuality, 0)} sub="Completeness of sampled records" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Standardisation and rationalisation trend" description="Rolling 12-month programme progress">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={savings}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                  <ReTooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="standardised"
                    name="Records standardised"
                    stroke={CHART_COLORS[0]}
                    fill={CHART_COLORS[0]}
                    fillOpacity={0.18}
                  />
                  <Area
                    type="monotone"
                    dataKey="rationalised"
                    name="Codes rationalised"
                    stroke={CHART_COLORS[1]}
                    fill={CHART_COLORS[1]}
                    fillOpacity={0.18}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <Section title="Match confidence distribution" description="Similarity bands across detected clusters">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={matchQuality} dataKey="value" nameKey="name" outerRadius={95}>
                    {matchQuality.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <ReTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </div>

        <Section title="Duplication density by category" description="Records inside duplicate clusters versus total records">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categorySpread}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={10} interval={0} angle={-18} height={60} textAnchor="end" />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <ReTooltip />
                <Legend />
                <Bar dataKey="records" name="Total records" fill={CHART_COLORS[2]} radius={[3, 3, 0, 0]} />
                <Bar dataKey="duplicates" name="In duplicate clusters" fill={CHART_COLORS[3]} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section title="CPSE scorecard" description="Programme readiness per organisation" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CPSE</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead>ERP</TableHead>
                  <TableHead className="text-right">Records</TableHead>
                  <TableHead className="text-right">Standardised</TableHead>
                  <TableHead className="text-right">Mapped</TableHead>
                  <TableHead className="text-right">Inventory (Cr)</TableHead>
                  <TableHead className="w-40">Coverage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scoped.map((p) => (
                  <TableRow key={p.id} className="hover:bg-surface">
                    <TableCell className="font-medium">{cpseName(p.id)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.sector}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.erp}</TableCell>
                    <TableCell className="numeric text-right">{fmtInt(p.records)}</TableCell>
                    <TableCell className="numeric text-right">{fmtInt(p.standardized)}</TableCell>
                    <TableCell className="numeric text-right">{fmtInt(p.mapped)}</TableCell>
                    <TableCell className="numeric text-right">{p.inventory}</TableCell>
                    <TableCell>
                      <MetricBar
                        value={p.coverage}
                        label={`${p.coverage}%`}
                        tone={p.coverage >= 70 ? "success" : p.coverage >= 45 ? "warning" : "critical"}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Section>

        <Section title="Data quality index" description="Average completeness score per CPSE">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={perCpse}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={10} />
                <YAxis domain={[40, 100]} stroke="var(--muted-foreground)" fontSize={11} />
                <ReTooltip />
                <Line type="monotone" dataKey="dq" name="Data quality %" stroke={CHART_COLORS[0]} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>
    </>
  );
}

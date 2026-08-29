import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowLeft, GitCompareArrows, Link2, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ConfidenceBadge,
  DetailRow,
  EmptyState,
  MetricBar,
  PageHeader,
  Section,
  StatusBadge,
  Timeline,
  fmtDateTime,
  fmtInt,
} from "@/components/kit";
import { useNumm } from "@/store/numm-store";

export const Route = createFileRoute("/materials/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Material ${params.id} — NUMM Material Master` },
      {
        name: "description",
        content:
          "Material profile with identity, technical specifications, CPSE cross-references, national code mapping and full traceability.",
      },
      { property: "og:title", content: "NUMM material profile" },
      {
        property: "og:description",
        content: "Traceability from original CPSE code to standardised attributes, national code, approval and audit history.",
      },
    ],
  }),
  component: MaterialDetail,
});

function MaterialDetail() {
  const { id } = Route.useParams();
  const { state, cpseName } = useNumm();
  const navigate = useNavigate();

  const material = state.materials.find((m) => m.id === id || m.cpseCode === id);
  const cluster = material?.clusterId ? state.clusters.find((c) => c.id === material.clusterId) : undefined;
  const siblings = useMemo(
    () => (cluster ? state.materials.filter((m) => cluster.memberIds.includes(m.id)) : []),
    [cluster, state.materials],
  );
  const mappings = state.mappings.filter((m) => m.nationalCode && m.nationalCode === material?.nationalCode);
  const audit = state.audit.filter((a) => a.entity === material?.cpseCode || a.entity === cluster?.id).slice(0, 12);

  if (!material) {
    return (
      <>
        <PageHeader title="Material not found" breadcrumb={[{ label: "NUMM", to: "/" }, { label: "Material Master", to: "/materials" }, { label: id }]} />
        <div className="p-6">
          <Section>
            <EmptyState
              title={`No material record for ${id}`}
              description="The record may have been merged into a national material code or removed from the registry."
              action={
                <Button variant="outline" onClick={() => navigate({ to: "/materials" })}>
                  Back to material master
                </Button>
              }
            />
          </Section>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={material.standardDescription ?? material.description}
        description={`${material.category} › ${material.subCategory} · Source record ${material.cpseCode} from ${cpseName(material.cpseId)}`}
        breadcrumb={[
          { label: "NUMM", to: "/" },
          { label: "Material Master", to: "/materials" },
          { label: material.cpseCode },
        ]}
        meta={
          <>
            <span>Lifecycle: {material.lifecycle}</span>
            <span>Version {material.version}</span>
            <span>Data quality {material.dataQuality}%</span>
            <span>Last updated {fmtDateTime(material.lastUpdated)}</span>
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => navigate({ to: "/materials" })}>
              <ArrowLeft className="size-4" /> Registry
            </Button>
            <Button variant="outline" onClick={() => navigate({ to: "/standardization", search: { material: material.id } })}>
              <SlidersHorizontal className="size-4" /> Standardize
            </Button>
            {cluster ? (
              <Button onClick={() => navigate({ to: "/harmonize", search: { cluster: cluster.id } })}>
                <GitCompareArrows className="size-4" /> Open harmonisation cluster
              </Button>
            ) : (
              <Button variant="outline" onClick={() => navigate({ to: "/duplicates" })}>
                Find duplicate candidates
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 p-4 md:p-6 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Section title="Identity" description="Registry identifiers and standardised naming">
            <dl>
              <DetailRow label="National material code" value={material.nationalCode ?? "Not assigned"} mono />
              <DetailRow label="CPSE material code" value={material.cpseCode} mono />
              <DetailRow label="CPSE" value={`${cpseName(material.cpseId)} · ${material.source}`} />
              <DetailRow label="Original description" value={material.description} />
              <DetailRow label="Standard description" value={material.standardDescription ?? "Pending standardisation"} />
              <DetailRow label="Classification" value={material.classificationPath.join(" › ")} />
              <DetailRow label="Unit of measure" value={material.uom} />
              <DetailRow label="Status" value={<StatusBadge status={material.status} />} />
              <DetailRow label="Approval" value={<StatusBadge status={material.approvalStatus} />} />
              <DetailRow label="Match confidence" value={<ConfidenceBadge value={material.confidence} />} />
            </dl>
          </Section>

          <Section title="Technical specifications" description="Structured attributes extracted from source descriptions and datasheets">
            <div className="grid gap-x-8 sm:grid-cols-2">
              {Object.entries(material.attributes).map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 border-b border-border py-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k}</span>
                  <span className="text-right text-sm text-foreground">{v}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Specification string: <span className="code-token">{material.specification}</span>
            </p>
          </Section>

          <Tabs defaultValue="cpse">
            <TabsList>
              <TabsTrigger value="cpse">CPSE references ({siblings.length})</TabsTrigger>
              <TabsTrigger value="mappings">Mappings ({mappings.length})</TabsTrigger>
              <TabsTrigger value="audit">Change history ({audit.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="cpse" className="mt-3">
              <Section bodyClassName="p-0">
                {siblings.length === 0 ? (
                  <EmptyState
                    title="No cross-CPSE references detected"
                    description="This record is not currently part of a duplicate or equivalence cluster."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>CPSE</TableHead>
                          <TableHead>CPSE code</TableHead>
                          <TableHead>Original description</TableHead>
                          <TableHead>UOM</TableHead>
                          <TableHead>Confidence</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {siblings.map((s) => (
                          <TableRow key={s.id} className={s.id === material.id ? "bg-surface" : undefined}>
                            <TableCell>{cpseName(s.cpseId)}</TableCell>
                            <TableCell className="code-token">
                              <Link to="/materials/$id" params={{ id: s.id }} className="hover:underline">
                                {s.cpseCode}
                              </Link>
                            </TableCell>
                            <TableCell className="max-w-[280px] truncate" title={s.description}>
                              {s.description}
                            </TableCell>
                            <TableCell>{s.uom}</TableCell>
                            <TableCell>
                              <ConfidenceBadge value={s.confidence} />
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={s.status} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </Section>
            </TabsContent>

            <TabsContent value="mappings" className="mt-3">
              <Section bodyClassName="p-0">
                {mappings.length === 0 ? (
                  <EmptyState
                    title="No active national mapping"
                    description="Once a harmonisation recommendation is approved, CPSE codes are mapped to the national code."
                    action={
                      <Button size="sm" variant="outline" onClick={() => navigate({ to: "/mapping" })}>
                        <Link2 className="size-3.5" /> Open CPSE mapping
                      </Button>
                    }
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>National code</TableHead>
                        <TableHead>CPSE</TableHead>
                        <TableHead>Legacy code</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Approved by</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mappings.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="code-token">{m.nationalCode}</TableCell>
                          <TableCell>{cpseName(m.cpseId)}</TableCell>
                          <TableCell className="code-token">{m.cpseCode}</TableCell>
                          <TableCell>
                            <StatusBadge status={m.status} />
                          </TableCell>
                          <TableCell className="text-muted-foreground">{m.approvedBy ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Section>
            </TabsContent>

            <TabsContent value="audit" className="mt-3">
              <Section>
                {audit.length === 0 ? (
                  <EmptyState title="No change history recorded for this record" />
                ) : (
                  <Timeline
                    items={audit.map((a) => ({
                      title: a.action,
                      meta: `${fmtDateTime(a.timestamp)} · ${a.user} (${a.role})`,
                      body: `${a.previousValue} → ${a.newValue} · ${a.reason}`,
                      tone: a.status === "success" ? "success" : a.status === "warning" ? "warning" : "info",
                    }))}
                  />
                )}
              </Section>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          <Section title="Traceability chain" description="Original CPSE record to national material master">
            <Timeline
              items={[
                { title: "Original CPSE record", meta: `${cpseName(material.cpseId)} · ${material.cpseCode}`, body: material.description, tone: "neutral" },
                {
                  title: cluster ? `Relationship detected (${cluster.matchType.replace(/-/g, " ")})` : "No relationship detected",
                  meta: cluster ? `${cluster.id} · similarity ${cluster.similarity.toFixed(1)}%` : "Singleton record",
                  body: cluster ? cluster.recommendation.rationale[0] : "Record is unique in the current registry sample.",
                  tone: cluster ? "info" : "neutral",
                },
                {
                  title: material.standardDescription ? "Standardised attributes applied" : "Standardisation pending",
                  meta: material.standardDescription ? `Version ${material.version}` : "Awaiting review",
                  body: material.standardDescription ?? undefined,
                  tone: material.standardDescription ? "success" : "warning",
                },
                {
                  title: material.nationalCode ? "National material code assigned" : "National code not assigned",
                  meta: material.nationalCode ?? "Pending approval",
                  tone: material.nationalCode ? "success" : "warning",
                },
                {
                  title: material.approvalStatus === "approved" ? "Approved and mapped" : `Approval: ${material.approvalStatus.replace(/-/g, " ")}`,
                  meta: mappings[0]?.approvedBy ? `Approved by ${mappings[0].approvedBy}` : "Awaiting reviewer decision",
                  tone: material.approvalStatus === "approved" ? "success" : "warning",
                },
              ]}
            />
          </Section>

          <Section title="Commercial & stock context">
            <dl>
              <DetailRow label="Manufacturer" value={material.manufacturer} />
              <DetailRow label="Last unit rate" value={`₹ ${fmtInt(material.unitRate)}`} />
              <DetailRow label="Stock on hand" value={`${fmtInt(material.stockQty)} ${material.uom}`} />
              <DetailRow label="Source system" value={material.source} />
            </dl>
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Data quality score</p>
              <MetricBar value={material.dataQuality} tone={material.dataQuality >= 85 ? "success" : material.dataQuality >= 70 ? "warning" : "critical"} />
            </div>
          </Section>

          {cluster ? (
            <Section title="Recommendation" description={`Cluster ${cluster.id}`}>
              <dl>
                <DetailRow label="National code" value={cluster.recommendation.nationalCode} mono />
                <DetailRow label="Standard description" value={cluster.recommendation.standardDescription} />
                <DetailRow label="Canonical UOM" value={cluster.recommendation.uom} />
                <DetailRow label="Confidence" value={<ConfidenceBadge value={cluster.recommendation.confidence} />} />
                <DetailRow label="Cluster status" value={<StatusBadge status={cluster.status} />} />
              </dl>
              <Button className="mt-3 w-full" size="sm" onClick={() => navigate({ to: "/harmonize", search: { cluster: cluster.id } })}>
                Review in workspace
              </Button>
            </Section>
          ) : null}
        </div>
      </div>
    </>
  );
}

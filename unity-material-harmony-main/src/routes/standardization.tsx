import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, Send, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ConfidenceBadge,
  DetailRow,
  EmptyState,
  Field,
  MetricBar,
  PageHeader,
  Section,
  StatusBadge,
  fmtInt,
  relTime,
} from "@/components/kit";
import { UOMS } from "@/data/dataset";
import type { Material } from "@/data/types";
import { useNumm } from "@/store/numm-store";

export const Route = createFileRoute("/standardization")({
  validateSearch: (search: Record<string, unknown>): { material?: string } =>
    typeof search["material"] === "string" ? { material: search["material"] } : {},
  head: () => ({
    meta: [
      { title: "Standardization Workbench — NUMM" },
      {
        name: "description",
        content:
          "Normalise CPSE material descriptions, units of measure and technical attributes into the national standard template.",
      },
      { property: "og:title", content: "NUMM standardization workbench" },
      {
        property: "og:description",
        content: "Rule-based description normalisation, attribute extraction and completeness scoring for material records.",
      },
    ],
  }),
  component: Standardization,
});

const ABBREVIATIONS: [RegExp, string][] = [
  [/\bss\b/gi, "STAINLESS STEEL"],
  [/\bms\b/gi, "MILD STEEL"],
  [/\bbrg\b/gi, "BEARING"],
  [/\bdia\b/gi, "DIAMETER"],
  [/\bthk\b/gi, "THICKNESS"],
  [/\bcbl\b/gi, "CABLE"],
  [/\bhyd\b/gi, "HYDRAULIC"],
  [/\bassy\b/gi, "ASSEMBLY"],
  [/\bqty\b/gi, "QUANTITY"],
];

function proposeDescription(m: Material) {
  let text = `${m.subCategory} ${m.specification} ${m.manufacturer}`.replace(/\s+/g, " ").toUpperCase();
  ABBREVIATIONS.forEach(([re, full]) => {
    text = text.replace(re, full);
  });
  const attrs = Object.entries(m.attributes)
    .map(([k, v]) => `${k.toUpperCase()} ${String(v).toUpperCase()}`)
    .join(", ");
  return [text, attrs].filter(Boolean).join(", ").slice(0, 220);
}

function completeness(desc: string, attrs: Record<string, string>, uom: string) {
  const filled = Object.values(attrs).filter((v) => v.trim().length > 0).length;
  const total = Math.max(1, Object.keys(attrs).length);
  const descScore = Math.min(1, desc.trim().length / 90);
  const uomScore = uom.trim() ? 1 : 0;
  return Math.round((filled / total) * 55 + descScore * 35 + uomScore * 10);
}

function Standardization() {
  const { material: materialParam } = Route.useSearch();
  const { state, dispatch, actor, cpseName, can } = useNumm();

  const queue = useMemo(
    () =>
      state.materials
        .filter((m) => !m.standardDescription || m.status === "unstandardized" || m.status === "under-review")
        .sort((a, b) => a.dataQuality - b.dataQuality),
    [state.materials],
  );

  const [selectedId, setSelectedId] = useState<string | null>(materialParam ?? queue[0]?.id ?? null);
  useEffect(() => {
    if (materialParam) setSelectedId(materialParam);
  }, [materialParam]);

  const selected = useMemo(
    () => state.materials.find((m) => m.id === selectedId) ?? queue[0] ?? null,
    [state.materials, selectedId, queue],
  );

  const [desc, setDesc] = useState("");
  const [uom, setUom] = useState("");
  const [attrs, setAttrs] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("Normalised to national description template");

  useEffect(() => {
    if (!selected) return;
    setDesc(selected.standardDescription ?? "");
    setUom(selected.uom);
    setAttrs({ ...selected.attributes });
  }, [selected]);

  const score = completeness(desc, attrs, uom);

  function save(submit: boolean) {
    if (!selected) return;
    dispatch({
      type: "material/standardize",
      id: selected.id,
      standardDescription: desc.trim(),
      attributes: attrs,
      uom,
      reason: reason.trim() || "Standardisation applied",
      submit,
      actor,
    });
    toast.success(submit ? "Submitted for approval" : "Standardisation saved", {
      description: `${selected.cpseCode} · completeness ${score}%`,
    });
  }

  return (
    <>
      <PageHeader
        title="Standardization workbench"
        description="Apply the national description template, normalise units and complete mandatory technical attributes before matching."
        breadcrumb={[{ label: "NUMM", to: "/" }, { label: "Standardization" }]}
        meta={
          <>
            <span>{fmtInt(queue.length)} records in queue</span>
            {selected ? <span>Editing {selected.cpseCode}</span> : null}
            {selected ? <span>Source: {selected.source}</span> : null}
          </>
        }
      />

      <div className="grid gap-4 p-4 md:p-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Section title="Standardisation queue" description="Lowest data quality first" bodyClassName="p-0">
          {queue.length === 0 ? (
            <EmptyState title="Queue is clear" description="Every sampled record carries a standard description." />
          ) : (
            <ScrollArea className="h-[640px]">
              <ul className="divide-y divide-border">
                {queue.slice(0, 120).map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(m.id)}
                      className={`w-full px-3 py-2.5 text-left transition-colors hover:bg-surface ${
                        selected?.id === m.id ? "bg-accent/50 shadow-[inset_2px_0_0_0_var(--primary)]" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="code-token">{m.cpseCode}</span>
                        <span className="numeric text-[11px] text-muted-foreground">DQ {m.dataQuality}%</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm">{m.description}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <StatusBadge status={m.status} />
                        <span className="text-[11px] text-muted-foreground">{cpseName(m.cpseId)}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </Section>

        {!selected ? (
          <Section>
            <EmptyState title="Select a record to standardise" />
          </Section>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Section title="Legacy CPSE record" description={`${cpseName(selected.cpseId)} · ${selected.source}`}>
                <dl>
                  <DetailRow label="CPSE code" value={selected.cpseCode} mono />
                  <DetailRow label="Raw description" value={selected.description} />
                  <DetailRow label="Specification" value={selected.specification} />
                  <DetailRow label="Unit of measure" value={selected.uom} />
                  <DetailRow label="Manufacturer" value={selected.manufacturer} />
                  <DetailRow label="Data quality" value={`${selected.dataQuality}%`} />
                  <DetailRow label="Last updated" value={relTime(selected.lastUpdated)} />
                </dl>
              </Section>

              <Section
                title="Standardised output"
                description="National description template"
                actions={
                  <Button variant="outline" size="sm" onClick={() => setDesc(proposeDescription(selected))}>
                    <Wand2 className="size-3.5" /> Auto-normalise
                  </Button>
                }
              >
                <div className="space-y-3">
                  <Field label="Standard description" hint="Uppercase, expanded abbreviations, noun-first ordering">
                    <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} />
                  </Field>
                  <Field label="Canonical unit of measure">
                    <Select value={uom} onValueChange={setUom}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UOMS.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Completeness score</span>
                      <span className="numeric font-semibold text-foreground">{score}%</span>
                    </div>
                    <MetricBar value={score} tone={score >= 85 ? "success" : score >= 60 ? "warning" : "critical"} />
                  </div>
                </div>
              </Section>
            </div>

            <Section
              title="Technical attributes"
              description="Structured attributes power similarity scoring and equivalence analysis"
              actions={<ConfidenceBadge value={selected.confidence} />}
            >
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {Object.keys(attrs).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No attributes captured for this record.</p>
                ) : (
                  Object.entries(attrs).map(([k, v]) => (
                    <Field key={k} label={k}>
                      <Input value={v} onChange={(e) => setAttrs((prev) => ({ ...prev, [k]: e.target.value }))} />
                    </Field>
                  ))
                )}
              </div>

              <div className="mt-4 border-t border-border pt-4">
                <Field label="Change reason (audit trail)">
                  <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
                </Field>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button disabled={!can("edit") || desc.trim().length < 8} onClick={() => save(false)}>
                    <Check className="size-4" /> Save standardisation
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!can("edit") || desc.trim().length < 8}
                    onClick={() => save(true)}
                  >
                    <Send className="size-4" /> Save and submit for approval
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setDesc(proposeDescription(selected));
                      setAttrs((prev) => {
                        const next = { ...prev };
                        Object.keys(next).forEach((k) => {
                          if (!next[k]?.trim()) next[k] = "TBC";
                        });
                        return next;
                      });
                      toast.info("Template applied", { description: "Review values before saving." });
                    }}
                  >
                    <Sparkles className="size-4" /> Apply full template
                  </Button>
                  {!can("edit") ? (
                    <p className="self-center text-xs text-muted-foreground">
                      Role “{actor.role}” has read-only access to standardisation.
                    </p>
                  ) : null}
                </div>
              </div>
            </Section>
          </div>
        )}
      </div>
    </>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, CircleDashed, Play, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Field, KpiCard, PageHeader, Section, StatusBadge, fmtDate, fmtInt } from "@/components/kit";
import { CPSES } from "@/data/dataset";
import type { MigrationBatch } from "@/data/types";
import { migrationService } from "@/services/api";
import { useNumm } from "@/store/numm-store";

export const Route = createFileRoute("/migration")({
  head: () => ({
    meta: [
      { title: "Legacy Migration & Rationalisation — NUMM" },
      {
        name: "description",
        content:
          "Guided migration of legacy CPSE material masters: upload, validate, resolve conflicts, map to national codes and cut over with rollback.",
      },
      { property: "og:title", content: "NUMM legacy migration" },
      {
        property: "og:description",
        content: "Eight-step migration wizard with validation reporting, conflict resolution and cutover controls.",
      },
    ],
  }),
  component: Migration,
});

const STEPS = [
  { key: "source", title: "Select source", detail: "Choose the CPSE and legacy dataset to migrate." },
  { key: "upload", title: "Upload extract", detail: "Ingest the ERP extract and profile the columns." },
  { key: "validate", title: "Validate", detail: "Run completeness, unit and classification checks." },
  { key: "conflicts", title: "Resolve conflicts", detail: "Triage duplicates and unit mismatches." },
  { key: "map", title: "Map to national codes", detail: "Apply approved harmonisation decisions." },
  { key: "review", title: "Review plan", detail: "Confirm the mapping and rationalisation summary." },
  { key: "execute", title: "Execute cutover", detail: "Write mappings and retire redundant legacy codes." },
  { key: "verify", title: "Verify & sign-off", detail: "Reconcile counts and record governance sign-off." },
];

function Migration() {
  const { state, dispatch, actor, cpseName, can } = useNumm();
  const [step, setStep] = useState(0);
  const [cpseId, setCpseId] = useState(CPSES[0]!.id);
  const [dataset, setDataset] = useState("MM_MASTER_EXTRACT_FY26.csv");
  const [records, setRecords] = useState(4800);
  const [validation, setValidation] = useState<{
    records: number;
    valid: number;
    errors: number;
    duplicates: number;
    missingFields: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [batchId, setBatchId] = useState<string | null>(null);

  const batches = useMemo(
    () => [...state.migrations].sort((a, b) => (a.startedOn < b.startedOn ? 1 : -1)),
    [state.migrations],
  );

  function upsert(patch: Partial<MigrationBatch>, reason?: string) {
    const id = batchId ?? `MIG-${String(state.migrations.length + 1).padStart(3, "0")}`;
    setBatchId(id);
    const existing = state.migrations.find((b) => b.id === id);
    const batch: MigrationBatch = {
      id,
      cpseId,
      dataset,
      legacyRecords: records,
      mapped: 0,
      unmapped: records,
      conflicts: 0,
      status: "draft",
      startedOn: existing?.startedOn ?? new Date().toISOString(),
      completedOn: null,
      progress: 0,
      ...existing,
      ...patch,
    };
    dispatch({ type: "migration/upsert", batch, actor, ...(reason ? { reason } : {}) });
    return batch;
  }

  async function runValidation() {
    setBusy(true);
    upsert({ status: "validating" }, "Validation started");
    const result = await migrationService.validate(records);
    setValidation(result);
    upsert(
      {
        status: "ready",
        conflicts: result.duplicates,
        unmapped: result.errors + result.duplicates,
        mapped: result.valid - result.duplicates,
      },
      "Validation completed",
    );
    setBusy(false);
    setStep(3);
    toast.success("Validation complete", {
      description: `${fmtInt(result.valid)} valid · ${fmtInt(result.duplicates)} duplicates · ${fmtInt(result.errors)} errors`,
    });
  }

  async function runExecute() {
    setBusy(true);
    const batch = upsert({ status: "executing" }, "Cutover started");
    await migrationService.execute((pct) => {
      setProgress(pct);
      dispatch({ type: "migration/progress", id: batch.id, progress: pct });
    });
    dispatch({ type: "migration/progress", id: batch.id, progress: 100, status: "completed" });
    dispatch({
      type: "notify",
      notification: {
        title: "Migration completed",
        body: `${cpseName(cpseId)} legacy extract migrated — ${fmtInt(records)} records processed.`,
        kind: "migration",
        link: "/migration",
      },
    });
    setBusy(false);
    setStep(7);
    toast.success("Cutover complete", { description: `${cpseName(cpseId)} is live on national codes.` });
  }

  return (
    <>
      <PageHeader
        title="Legacy migration & rationalisation"
        description="A controlled path from a CPSE's legacy material master to the national master, preserving traceability of every retired code."
        breadcrumb={[{ label: "NUMM", to: "/" }, { label: "Migration" }]}
        meta={
          <>
            <span>{fmtInt(batches.length)} batches</span>
            <span>Step {step + 1} of {STEPS.length}: {STEPS[step]!.title}</span>
            <span>{cpseName(cpseId)}</span>
          </>
        }
        actions={
          <Button
            variant="outline"
            onClick={() => {
              setStep(0);
              setValidation(null);
              setProgress(0);
              setBatchId(null);
              toast.info("Wizard reset");
            }}
          >
            <RotateCcw className="size-4" /> Restart wizard
          </Button>
        }
      />

      <div className="space-y-4 p-4 md:p-6">
        <Section title="Migration wizard" description="Each step records an audit event">
          <ol className="grid gap-2 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  className={`w-full rounded-md border p-3 text-left transition-colors ${
                    i === step
                      ? "border-primary bg-accent/60"
                      : i < step
                        ? "border-border bg-surface"
                        : "border-border hover:bg-surface"
                  }`}
                >
                  <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {i < step ? <Check className="size-3.5 text-success" /> : <CircleDashed className="size-3.5" />}
                    Step {i + 1}
                  </span>
                  <span className="mt-1 block text-sm font-medium">{s.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{s.detail}</span>
                </button>
              </li>
            ))}
          </ol>

          <div className="mt-4 rounded-md border border-border p-4">
            {step === 0 ? (
              <div className="grid gap-3 md:grid-cols-3">
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
                <Field label="Legacy dataset">
                  <Input value={dataset} onChange={(e) => setDataset(e.target.value)} />
                </Field>
                <Field label="Legacy record count">
                  <Input
                    type="number"
                    value={records}
                    onChange={(e) => setRecords(Math.max(1, Number(e.target.value) || 0))}
                  />
                </Field>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm text-muted-foreground">
                  Extract profiling reads column headers, detects the code and description fields and samples value
                  distributions. No data leaves the national environment.
                </p>
                <Button
                  onClick={() => {
                    upsert({ status: "draft" }, "Extract ingested");
                    toast.success(`${dataset} ingested`, { description: `${fmtInt(records)} rows staged.` });
                    setStep(2);
                  }}
                >
                  <Upload className="size-4" /> Ingest extract
                </Button>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm text-muted-foreground">
                  Validation checks mandatory attributes, unit-of-measure validity, classification coverage and
                  duplicate density against the national master.
                </p>
                <Button onClick={runValidation} disabled={busy}>
                  {busy ? "Validating…" : "Run validation"}
                </Button>
              </div>
            ) : null}

            {step === 3 ? (
              validation ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <KpiCard label="Records validated" value={fmtInt(validation.records)} sub="Rows profiled" />
                  <KpiCard label="Clean records" value={fmtInt(validation.valid)} sub="Ready to map" tone="success" />
                  <KpiCard label="Duplicates" value={fmtInt(validation.duplicates)} sub="Routed to harmonisation" tone="warning" />
                  <KpiCard label="Errors" value={fmtInt(validation.errors)} sub="Missing mandatory fields" tone="critical" />
                </div>
              ) : (
                <EmptyState title="Run validation first" description="Return to step 3 and validate the extract." />
              )
            ) : null}

            {step === 4 ? (
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm text-muted-foreground">
                  Approved harmonisation decisions are applied automatically; unresolved duplicates stay in the review
                  queue and migrate as provisional codes.
                </p>
                <Button
                  onClick={() => {
                    upsert({ status: "ready" }, "National code mapping applied");
                    toast.success("Mapping plan prepared");
                    setStep(5);
                  }}
                >
                  Apply national code mapping
                </Button>
              </div>
            ) : null}

            {step === 5 ? (
              <dl className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border border-border p-3">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">CPSE</dt>
                  <dd className="mt-1 text-sm font-medium">{cpseName(cpseId)}</dd>
                </div>
                <div className="rounded-md border border-border p-3">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Dataset</dt>
                  <dd className="mt-1 text-sm font-medium">{dataset}</dd>
                </div>
                <div className="rounded-md border border-border p-3">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Records to migrate</dt>
                  <dd className="numeric mt-1 text-sm font-medium">{fmtInt(validation?.valid ?? records)}</dd>
                </div>
                <div className="rounded-md border border-border p-3">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Codes to retire</dt>
                  <dd className="numeric mt-1 text-sm font-medium">{fmtInt(validation?.duplicates ?? 0)}</dd>
                </div>
              </dl>
            ) : null}

            {step === 6 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Cutover writes mappings, retires redundant legacy codes and publishes the national codes back to the
                  CPSE ERP. A rollback point is captured before execution.
                </p>
                <Progress value={progress} />
                <Button onClick={runExecute} disabled={busy || !can("migrate")}>
                  <Play className="size-4" /> {busy ? `Executing… ${progress}%` : "Execute cutover"}
                </Button>
                {!can("migrate") ? (
                  <p className="text-xs text-muted-foreground">Role “{actor.role}” cannot execute migrations.</p>
                ) : null}
              </div>
            ) : null}

            {step === 7 ? (
              <div className="space-y-3">
                <p className="text-sm text-foreground">
                  Cutover reconciled: {fmtInt(validation?.valid ?? records)} records migrated for {cpseName(cpseId)}.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    dispatch({
                      type: "audit",
                      event: {
                        user: actor.name,
                        role: actor.role,
                        action: "Migration signed off",
                        entity: batchId ?? dataset,
                        previousValue: "completed",
                        newValue: "signed-off",
                        reason: "Counts reconciled against source extract",
                        status: "success",
                      },
                    });
                    toast.success("Sign-off recorded");
                  }}
                >
                  Record governance sign-off
                </Button>
              </div>
            ) : null}

            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
                Back
              </Button>
              <Button
                variant="outline"
                disabled={step === STEPS.length - 1}
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              >
                Next step
              </Button>
            </div>
          </div>
        </Section>

        <Section title="Migration batches" description="History across all CPSEs" bodyClassName="p-0">
          {batches.length === 0 ? (
            <EmptyState title="No migration batches yet" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch</TableHead>
                    <TableHead>CPSE</TableHead>
                    <TableHead>Dataset</TableHead>
                    <TableHead className="text-right">Legacy records</TableHead>
                    <TableHead className="text-right">Mapped</TableHead>
                    <TableHead className="text-right">Conflicts</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead className="w-40">Progress</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((b) => (
                    <TableRow key={b.id} className="hover:bg-surface">
                      <TableCell className="code-token">{b.id}</TableCell>
                      <TableCell className="text-sm">{cpseName(b.cpseId)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{b.dataset}</TableCell>
                      <TableCell className="numeric text-right">{fmtInt(b.legacyRecords)}</TableCell>
                      <TableCell className="numeric text-right">{fmtInt(b.mapped)}</TableCell>
                      <TableCell className="numeric text-right">{fmtInt(b.conflicts)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(b.startedOn)}</TableCell>
                      <TableCell>
                        <Progress value={b.progress} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={b.status} />
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

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PlugZap, RefreshCw, TestTube2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState, KpiCard, PageHeader, Section, StatusBadge, fmtInt, relTime } from "@/components/kit";
import { integrationService } from "@/services/api";
import { useNumm } from "@/store/numm-store";

export const Route = createFileRoute("/integrations")({
  head: () => ({
    meta: [
      { title: "ERP Integrations — NUMM" },
      {
        name: "description",
        content:
          "Connection health for CPSE ERP systems feeding the national material master, with sync history and endpoint diagnostics.",
      },
      { property: "og:title", content: "NUMM ERP integrations" },
      {
        property: "og:description",
        content: "SAP, Oracle and custom ERP connectors with sync counts, error logs and connection tests.",
      },
    ],
  }),
  component: Integrations,
});

function Integrations() {
  const { state, dispatch, cpseName, can } = useNumm();
  const [selectedId, setSelectedId] = useState<string | null>(state.integrations[0]?.id ?? null);
  const [busy, setBusy] = useState<string | null>(null);

  const selected = state.integrations.find((i) => i.id === selectedId) ?? state.integrations[0] ?? null;

  async function test(id: string) {
    setBusy(id);
    const result = await integrationService.test(id);
    dispatch({
      type: "integration/patch",
      id,
      patch: { status: "connected" },
      log: { timestamp: new Date().toISOString(), level: "info", message: `Connection test passed in ${result.roundTripMs} ms` },
    });
    setBusy(null);
    toast.success("Connection healthy", { description: `Round trip ${result.roundTripMs} ms` });
  }

  async function sync(id: string) {
    setBusy(id);
    dispatch({ type: "integration/patch", id, patch: { status: "syncing" } });
    const result = await integrationService.sync(id);
    dispatch({
      type: "integration/patch",
      id,
      patch: {
        status: result.errors > 4 ? "warning" : "connected",
        lastSync: new Date().toISOString(),
        recordsImported: (state.integrations.find((i) => i.id === id)?.recordsImported ?? 0) + result.imported,
        errors: result.errors,
      },
      log: {
        timestamp: new Date().toISOString(),
        level: result.errors > 4 ? "warn" : "info",
        message: `Delta sync imported ${fmtInt(result.imported)} records with ${result.errors} errors`,
      },
    });
    dispatch({
      type: "notify",
      notification: {
        title: "ERP sync complete",
        body: `${fmtInt(result.imported)} records imported with ${result.errors} errors.`,
        kind: "integration",
        link: "/integrations",
      },
    });
    setBusy(null);
    toast.success("Sync complete", { description: `${fmtInt(result.imported)} records imported` });
  }

  const connected = state.integrations.filter((i) => i.status === "connected").length;

  return (
    <>
      <PageHeader
        title="ERP integrations"
        description="Each CPSE connects its material master through a governed connector; NUMM never writes to source systems without an approved mapping."
        breadcrumb={[{ label: "NUMM", to: "/" }, { label: "Integrations" }]}
        meta={
          <>
            <span>{fmtInt(state.integrations.length)} connectors</span>
            <span>{fmtInt(connected)} healthy</span>
            <span>
              {fmtInt(state.integrations.reduce((a, i) => a + i.recordsImported, 0))} records imported to date
            </span>
          </>
        }
      />

      <div className="space-y-4 p-4 md:p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Connectors online" value={`${connected}/${state.integrations.length}`} sub="Healthy connections" tone="success" />
          <KpiCard
            label="Records imported"
            value={fmtInt(state.integrations.reduce((a, i) => a + i.recordsImported, 0))}
            sub="Cumulative inbound volume"
            tone="info"
          />
          <KpiCard
            label="Records exported"
            value={fmtInt(state.integrations.reduce((a, i) => a + i.recordsExported, 0))}
            sub="National codes published back"
          />
          <KpiCard
            label="Open sync errors"
            value={fmtInt(state.integrations.reduce((a, i) => a + i.errors, 0))}
            sub="Rows rejected in last sync"
            tone="warning"
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Section title="Connectors" description="One connector per CPSE ERP instance" bodyClassName="p-3">
            <ul className="grid gap-3 md:grid-cols-2">
              {state.integrations.map((i) => (
                <li
                  key={i.id}
                  className={`rounded-md border p-3 ${selected?.id === i.id ? "border-primary bg-accent/40" : "border-border"}`}
                >
                  <button type="button" className="w-full text-left" onClick={() => setSelectedId(i.id)}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <PlugZap className="size-4 text-muted-foreground" aria-hidden /> {i.system}
                      </span>
                      <StatusBadge status={i.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {cpseName(i.cpseId)} · last sync {relTime(i.lastSync)}
                    </p>
                    <p className="code-token mt-1 truncate text-[11px]">{i.endpoint}</p>
                    <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                      <div>
                        <dt>Imported</dt>
                        <dd className="numeric text-foreground">{fmtInt(i.recordsImported)}</dd>
                      </div>
                      <div>
                        <dt>Exported</dt>
                        <dd className="numeric text-foreground">{fmtInt(i.recordsExported)}</dd>
                      </div>
                      <div>
                        <dt>Errors</dt>
                        <dd className="numeric text-foreground">{fmtInt(i.errors)}</dd>
                      </div>
                    </dl>
                  </button>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" disabled={busy === i.id} onClick={() => test(i.id)}>
                      <TestTube2 className="size-3.5" /> Test
                    </Button>
                    <Button size="sm" disabled={busy === i.id || !can("configure")} onClick={() => sync(i.id)}>
                      <RefreshCw className="size-3.5" /> {busy === i.id ? "Working…" : "Sync now"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <Section
            title={selected ? `Activity log · ${selected.system}` : "Activity log"}
            description="Most recent connector events"
            bodyClassName="p-0"
          >
            {!selected || selected.logs.length === 0 ? (
              <EmptyState title="No connector events" description="Run a test or sync to generate log entries." />
            ) : (
              <ScrollArea className="h-[420px]">
                <ul className="divide-y divide-border">
                  {selected.logs.map((l, idx) => (
                    <li key={idx} className="px-4 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[11px] font-semibold uppercase tracking-wide ${
                            l.level === "error" ? "text-critical" : l.level === "warn" ? "text-warning" : "text-info"
                          }`}
                        >
                          {l.level}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{relTime(l.timestamp)}</span>
                      </div>
                      <p className="mt-1 text-sm text-foreground">{l.message}</p>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}

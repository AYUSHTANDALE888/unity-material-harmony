import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DetailRow, Field, PageHeader, Section, StatusBadge } from "@/components/kit";
import { CPSES, ROLES, USERS } from "@/data/dataset";
import { useNumm } from "@/store/numm-store";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Platform Settings — NUMM" },
      {
        name: "description",
        content:
          "Configure matching thresholds, approval policy, role capabilities and CPSE onboarding for the national material master platform.",
      },
      { property: "og:title", content: "NUMM platform settings" },
      {
        property: "og:description",
        content: "Matching thresholds, dual approval policy, role capability matrix and participating CPSE registry.",
      },
    ],
  }),
  component: Settings,
});

const CAPABILITY_MATRIX: Record<string, string[]> = {
  "National Administrator": ["Approve", "Edit", "Map", "Migrate", "Configure"],
  "CPSE Administrator": ["Edit", "Map", "Migrate"],
  "Material Engineer": ["Edit", "Map"],
  "Procurement Officer": ["Edit"],
  Reviewer: ["Approve", "Edit"],
  Auditor: ["Read-only"],
};

function Settings() {
  const { state, dispatch, actor, can } = useNumm();
  const [autoThreshold, setAutoThreshold] = useState(97);
  const [reviewThreshold, setReviewThreshold] = useState(85);
  const [dualApproval, setDualApproval] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [slaDays, setSlaDays] = useState(5);
  const [codePrefix, setCodePrefix] = useState("NUMM");

  return (
    <>
      <PageHeader
        title="Platform settings"
        description="Programme-level configuration governing how candidate matches are scored, escalated and approved."
        breadcrumb={[{ label: "NUMM", to: "/" }, { label: "Settings" }]}
        meta={
          <>
            <span>Signed in as {actor.name}</span>
            <span>Role: {actor.role}</span>
            <span>{CPSES.length} CPSEs onboarded</span>
          </>
        }
        actions={
          <Button
            disabled={!can("configure")}
            onClick={() => {
              dispatch({
                type: "audit",
                event: {
                  user: actor.name,
                  role: actor.role,
                  action: "Platform configuration updated",
                  entity: "Matching & approval policy",
                  previousValue: "previous policy",
                  newValue: `auto ≥ ${autoThreshold}%, review ≥ ${reviewThreshold}%, dual approval ${dualApproval ? "on" : "off"}, SLA ${slaDays}d`,
                  reason: "Configuration saved from settings module",
                  status: "success",
                },
              });
              toast.success("Configuration saved", { description: "Audit event recorded." });
            }}
          >
            Save configuration
          </Button>
        }
      />

      <div className="space-y-4 p-4 md:p-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Matching thresholds" description="Controls how the detection engine routes candidates">
            <div className="space-y-5">
              <Field label={`Auto-recommendation threshold — ${autoThreshold}%`} hint="Candidates at or above this score are auto-recommended">
                <Slider
                  value={[autoThreshold]}
                  min={90}
                  max={100}
                  step={1}
                  onValueChange={(v) => setAutoThreshold(v[0] ?? 97)}
                  aria-label="Auto recommendation threshold"
                />
              </Field>
              <Field label={`Human review threshold — ${reviewThreshold}%`} hint="Below this score candidates are discarded as noise">
                <Slider
                  value={[reviewThreshold]}
                  min={60}
                  max={95}
                  step={1}
                  onValueChange={(v) => setReviewThreshold(v[0] ?? 85)}
                  aria-label="Human review threshold"
                />
              </Field>
              <Field label={`Review SLA — ${slaDays} working days`}>
                <Slider value={[slaDays]} min={1} max={15} step={1} onValueChange={(v) => setSlaDays(v[0] ?? 5)} aria-label="Review SLA" />
              </Field>
            </div>
          </Section>

          <Section title="Approval policy" description="Governance controls applied to every harmonisation decision">
            <div className="space-y-4">
              <label className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
                <span>
                  <span className="block text-sm font-medium">Dual approval for national codes</span>
                  <span className="block text-xs text-muted-foreground">
                    Requires a reviewer and a governance officer before activation.
                  </span>
                </span>
                <Switch checked={dualApproval} onCheckedChange={setDualApproval} aria-label="Dual approval" />
              </label>
              <label className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
                <span>
                  <span className="block text-sm font-medium">Email notifications</span>
                  <span className="block text-xs text-muted-foreground">
                    Notify owners when clusters breach the review SLA.
                  </span>
                </span>
                <Switch checked={notifyEmail} onCheckedChange={setNotifyEmail} aria-label="Email notifications" />
              </label>
              <Field label="National code prefix">
                <Input value={codePrefix} onChange={(e) => setCodePrefix(e.target.value.toUpperCase())} className="code-token" />
              </Field>
              <dl>
                <DetailRow label="Sample code" value={`${codePrefix}-BEA-000148`} mono />
                <DetailRow label="Codes issued" value={String(state.nationalCodes.length)} />
                <DetailRow label="Audit retention" value="10 years" />
              </dl>
            </div>
          </Section>
        </div>

        <Section title="Role capability matrix" description="What each role may do inside the platform" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Capabilities</TableHead>
                  <TableHead>Active users</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ROLES.map((role) => (
                  <TableRow key={role} className="hover:bg-surface">
                    <TableCell className="text-sm font-medium">{role}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {(CAPABILITY_MATRIX[role] ?? ["Read-only"]).join(" · ")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {USERS.filter((u) => u.role === role)
                        .map((u) => u.name)
                        .join(", ") || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Section>

        <Section
          title="Participating CPSEs"
          description="Onboarded organisations and their source ERP systems"
          actions={
            <Select
              value={state.activeCpse}
              onValueChange={(v) => {
                dispatch({ type: "cpse/active", id: v });
                toast.success(v === "ALL" ? "Scope set to all CPSEs" : `Scope set to ${v}`);
              }}
            >
              <SelectTrigger className="h-9 w-44" aria-label="Default scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All CPSEs</SelectItem>
                {CPSES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.shortName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
          bodyClassName="p-0"
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CPSE</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Source ERP</TableHead>
                  <TableHead>Connector</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {CPSES.map((c) => {
                  const connector = state.integrations.find((i) => i.cpseId === c.id);
                  return (
                    <TableRow key={c.id} className="hover:bg-surface">
                      <TableCell className="text-sm font-medium">{c.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.sector}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.region}</TableCell>
                      <TableCell className="text-sm">{c.erp}</TableCell>
                      <TableCell>
                        {connector ? <StatusBadge status={connector.status} /> : <StatusBadge status="offline" />}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Section>
      </div>
    </>
  );
}

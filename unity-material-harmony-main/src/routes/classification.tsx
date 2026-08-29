import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Field, KpiCard, PageHeader, Section, StatusBadge, fmtInt } from "@/components/kit";
import type { ClassificationNode } from "@/data/types";
import { useNumm } from "@/store/numm-store";

export const Route = createFileRoute("/classification")({
  head: () => ({
    meta: [
      { title: "Classification Hierarchy — NUMM" },
      {
        name: "description",
        content:
          "Browse and extend the national UNSPSC-aligned material classification hierarchy and inspect the records held at each node.",
      },
      { property: "og:title", content: "NUMM classification hierarchy" },
      {
        property: "og:description",
        content: "Segment, family and class levels of the national material taxonomy with record counts.",
      },
    ],
  }),
  component: Classification,
});

function Classification() {
  const navigate = useNavigate();
  const { state, dispatch, actor, can, cpseName } = useNumm();
  const [expanded, setExpanded] = useState<string[]>(state.classification.slice(0, 2).map((n) => n.id));
  const [selected, setSelected] = useState<ClassificationNode | null>(state.classification[0] ?? null);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const nodeCount = useMemo(() => {
    let n = 0;
    const walk = (nodes: ClassificationNode[]) => {
      nodes.forEach((c) => {
        n += 1;
        walk(c.children);
      });
    };
    walk(state.classification);
    return n;
  }, [state.classification]);

  const nodeMaterials = useMemo(
    () =>
      selected
        ? state.materials.filter((m) => m.classificationPath.some((p) => p.toLowerCase() === selected.name.toLowerCase()))
        : [],
    [selected, state.materials],
  );

  const toggle = (id: string) =>
    setExpanded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  function renderNodes(nodes: ClassificationNode[], depth = 0) {
    return (
      <ul className={depth === 0 ? "space-y-0.5" : "ml-4 space-y-0.5 border-l border-border pl-2"}>
        {nodes.map((n) => {
          const open = expanded.includes(n.id);
          const isSelected = selected?.id === n.id;
          return (
            <li key={n.id}>
              <div className="flex items-center gap-1">
                {n.children.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => toggle(n.id)}
                    aria-label={open ? `Collapse ${n.name}` : `Expand ${n.name}`}
                    className="rounded-sm p-0.5 text-muted-foreground hover:bg-surface hover:text-foreground"
                  >
                    {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                  </button>
                ) : (
                  <span className="inline-block size-[18px]" />
                )}
                <button
                  type="button"
                  onClick={() => setSelected(n)}
                  className={`flex-1 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface ${
                    isSelected ? "bg-accent/60 font-semibold" : ""
                  }`}
                >
                  {n.name}
                  <span className="ml-2 text-[11px] font-normal text-muted-foreground">L{n.level}</span>
                </button>
              </div>
              {open && n.children.length > 0 ? renderNodes(n.children, depth + 1) : null}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <>
      <PageHeader
        title="Classification hierarchy"
        description="A single national taxonomy (UNSPSC-aligned) replaces divergent CPSE category trees and drives classification-based similarity scoring."
        breadcrumb={[{ label: "NUMM", to: "/" }, { label: "Classification" }]}
        meta={
          <>
            <span>{fmtInt(nodeCount)} nodes</span>
            <span>{fmtInt(state.classification.length)} top-level segments</span>
            {selected ? <span>Selected: {selected.name}</span> : null}
          </>
        }
        actions={
          <Button onClick={() => setAddOpen(true)} disabled={!can("edit")}>
            <FolderPlus className="size-4" /> Add node
          </Button>
        }
      />

      <div className="grid gap-4 p-4 md:p-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Section title="Taxonomy" description="Segment › family › class" bodyClassName="p-3">
          {state.classification.length === 0 ? (
            <EmptyState title="No classification nodes" />
          ) : (
            renderNodes(state.classification)
          )}
        </Section>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard label="Records at node" value={fmtInt(nodeMaterials.length)} sub={selected?.name ?? "—"} tone="info" />
            <KpiCard
              label="Child nodes"
              value={fmtInt(selected?.children.length ?? 0)}
              sub="Direct descendants"
            />
            <KpiCard
              label="Standardised at node"
              value={fmtInt(nodeMaterials.filter((m) => m.standardDescription).length)}
              sub="Records on national template"
              tone="success"
            />
          </div>

          <Section
            title={selected ? `Records classified under ${selected.name}` : "Records"}
            description="Click a row to open the full material profile"
            bodyClassName="p-0"
          >
            {nodeMaterials.length === 0 ? (
              <EmptyState
                title="No records at this node"
                description="Select a lower-level class to see the materials assigned to it."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CPSE code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>CPSE</TableHead>
                      <TableHead>Classification path</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nodeMaterials.slice(0, 40).map((m) => (
                      <TableRow
                        key={m.id}
                        className="cursor-pointer hover:bg-surface"
                        onClick={() => navigate({ to: "/materials/$id", params: { id: m.id } })}
                      >
                        <TableCell className="code-token">{m.cpseCode}</TableCell>
                        <TableCell className="max-w-[300px] text-sm">{m.description}</TableCell>
                        <TableCell className="text-sm">{cpseName(m.cpseId)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{m.classificationPath.join(" › ")}</TableCell>
                        <TableCell>
                          <StatusBadge status={m.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Section>
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add classification node</DialogTitle>
            <DialogDescription>
              {selected
                ? `The new node will be created under “${selected.name}”.`
                : "The new node will be created as a top-level segment."}
            </DialogDescription>
          </DialogHeader>
          <Field label="Node name">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Cryogenic Valves" />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={newName.trim().length < 3}
              onClick={() => {
                dispatch({
                  type: "classification/create",
                  parentId: selected?.id ?? null,
                  name: newName.trim(),
                  actor,
                });
                toast.success("Classification node created", {
                  description: selected ? `Added under ${selected.name}` : "Added as a new segment",
                });
                setNewName("");
                setAddOpen(false);
              }}
            >
              Create node
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

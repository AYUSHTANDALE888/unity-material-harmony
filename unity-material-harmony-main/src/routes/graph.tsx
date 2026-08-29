import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useRef } from "react";
import {
  Network,
  Search,
  Sparkles,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ArrowRight,
  ExternalLink,
  GitFork,
  Boxes,
  Database,
  Tag,
  CheckCircle2,
  AlertTriangle,
  FileQuestion,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard, PageHeader, StatusBadge, fmtInt } from "@/components/kit";
import { useNumm } from "@/store/numm-store";
import { CPSES } from "@/data/dataset";
import type { Material, NationalMaterialCode } from "@/data/types";

export const Route = createFileRoute("/graph")({
  head: () => ({
    meta: [
      { title: "Material Knowledge Graph & Graph Text — NUMM" },
      {
        name: "description",
        content:
          "Interactive Knowledge Graph and text-to-graph relationship explorer connecting CPSE material masters, national codes, and duplicate clusters.",
      },
      { property: "og:title", content: "NUMM Material Knowledge Graph" },
      {
        property: "og:description",
        content: "Explore multi-enterprise material taxonomy, semantic linkages, and cross-CPSE duplicate networks.",
      },
    ],
  }),
  component: GraphView,
});

interface GraphNode {
  id: string;
  label: string;
  sublabel: string;
  type: "national" | "material" | "cluster" | "category" | "extracted";
  cpseId?: string;
  category?: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  radius: number;
  color: string;
  data?: any;
}

interface GraphLink {
  source: string;
  target: string;
  label?: string;
  similarity?: number;
  type: "mapped" | "duplicate" | "category" | "semantic";
}

// Global threshold constants ensuring exact synchronisation between logic and UI copy
const CONFIDENCE_THRESHOLD_PCT = 45;
const CONFIDENCE_THRESHOLD_DECIMAL = CONFIDENCE_THRESHOLD_PCT / 100;

const PRESET_QUERIES = [
  "Deep groove ball bearing 6205 2RS C3 SKF",
  "Gate valve 50mm 150# RF ASTM A105 flanged",
  "Centrifugal slurry pump impeller SS316 120m3/h",
  "Seamless carbon steel pipe 4 inch sch 40 ASTM A106 Gr B",
  "Pressure transmitter 4-20mA HART 0-10 bar Yokogawa",
  "asdlkfj random unclassified text 999xyz",
];

const CPSE_COLORS: Record<string, string> = {
  BHEL: "#3B82F6",
  ONGC: "#EF4444",
  SAIL: "#8B5CF6",
  NTPC: "#10B981",
  IOCL: "#F59E0B",
  GAIL: "#EC4899",
  CIL: "#14B8A6",
};

// Tokenizer & String utilities for realistic AI / semantic matching
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s#\-\/]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !["the", "and", "for", "with", "item", "qty", "nos", "type"].includes(t));
}

export function GraphView() {
  const navigate = useNavigate();
  const { state } = useNumm();

  const [activeTab, setActiveTab] = useState<"graph" | "text">("graph");
  const [selectedCpse, setSelectedCpse] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [similarityThreshold, setSimilarityThreshold] = useState<number>(75);
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // Graph Text Query State
  const [textQuery, setTextQuery] = useState<string>("Deep groove ball bearing 6205 2RS C3 SKF");
  const [analyzedQuery, setAnalyzedQuery] = useState<string>("Deep groove ball bearing 6205 2RS C3 SKF");

  // Transform / Pan / Zoom State
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    state.materials.forEach((m) => {
      if (m.category) set.add(m.category);
    });
    return Array.from(set);
  }, [state.materials]);

  // Real-time dynamic KPIs derived directly from ground-truth active dataset
  const kpiStats = useMemo(() => {
    let filtered = state.materials;
    if (selectedCpse !== "ALL") {
      filtered = filtered.filter((m) => m.cpseId === selectedCpse);
    }
    if (selectedCategory !== "ALL") {
      filtered = filtered.filter((m) => m.category === selectedCategory);
    }
    const total = filtered.length;
    const mapped = filtered.filter((m) => m.nationalCode && m.nationalCode.trim() !== "").length;
    const rate = total > 0 ? ((mapped / total) * 100).toFixed(1) + "%" : "0.0%";
    const activeCpsesCount = selectedCpse === "ALL"
      ? new Set(filtered.map((m) => m.cpseId)).size
      : 1;

    return {
      total,
      mapped,
      rate,
      activeCpsesCount,
    };
  }, [state.materials, selectedCpse, selectedCategory]);

  // Construct Knowledge Graph Nodes & Links (with connected hubs & proper topology)
  const graphData = useMemo(() => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const nodeMap = new Map<string, GraphNode>();

    let filteredMaterials = state.materials;
    if (selectedCpse !== "ALL") {
      filteredMaterials = filteredMaterials.filter((m) => m.cpseId === selectedCpse);
    }
    if (selectedCategory !== "ALL") {
      filteredMaterials = filteredMaterials.filter((m) => m.category === selectedCategory);
    }
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      filteredMaterials = filteredMaterials.filter(
        (m) =>
          m.cpseCode.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.specification?.toLowerCase().includes(q)
      );
    }

    const maxItems = 40;
    const subset = filteredMaterials.slice(0, maxItems);

    // Track which national codes are referenced by the visible subset of materials
    const referencedNationalCodes = new Set<string>();
    subset.forEach((m) => {
      if (m.nationalCode) referencedNationalCodes.add(m.nationalCode);
    });

    // 1. National Code Hub Nodes: Only include if referenced by subset materials
    // OR if category is specifically selected and has active materials
    const activeNationalCodes = state.nationalCodes.filter((nc) => {
      if (referencedNationalCodes.has(nc.code)) return true;
      if (selectedCategory !== "ALL" && nc.category === selectedCategory && subset.length > 0) return true;
      return false;
    }).slice(0, 8);

    activeNationalCodes.forEach((nc, idx) => {
      const totalHubs = Math.max(activeNationalCodes.length, 1);
      const angle = (idx / totalHubs) * Math.PI * 2;
      const radius = 170;
      const node: GraphNode = {
        id: `nc-${nc.code}`,
        label: nc.code,
        sublabel: nc.standardDescription,
        type: "national",
        category: nc.category,
        x: 400 + Math.cos(angle) * radius,
        y: 280 + Math.sin(angle) * radius,
        radius: 22,
        color: "#0284C7",
        data: nc,
      };
      nodes.push(node);
      nodeMap.set(node.id, node);
    });

    // 2. Material Record Nodes
    subset.forEach((mat, idx) => {
      const totalMats = Math.max(subset.length, 1);
      const angle = (idx / totalMats) * Math.PI * 2 + (idx % 2 === 0 ? 0.3 : -0.3);
      const dist = 270 + (idx % 3) * 55;
      const cpseColor = CPSE_COLORS[mat.cpseId] || "#64748B";

      const node: GraphNode = {
        id: `mat-${mat.id}`,
        label: mat.cpseCode,
        sublabel: mat.description,
        type: "material",
        cpseId: mat.cpseId,
        category: mat.category,
        x: 400 + Math.cos(angle) * dist,
        y: 280 + Math.sin(angle) * dist,
        radius: 14,
        color: cpseColor,
        data: mat,
      };
      nodes.push(node);
      nodeMap.set(node.id, node);

      // Link to National Code if mapped and node exists
      if (mat.nationalCode && nodeMap.has(`nc-${mat.nationalCode}`)) {
        links.push({
          source: node.id,
          target: `nc-${mat.nationalCode}`,
          label: `${mat.confidence || 95}% Match`,
          similarity: mat.confidence || 95,
          type: "mapped",
        });
      } else if (activeNationalCodes.length > 0) {
        // Connect to closest category national code if available to avoid disconnected floating orphans
        const catMatch = activeNationalCodes.find((nc) => nc.category === mat.category);
        if (catMatch && nodeMap.has(`nc-${catMatch.code}`)) {
          links.push({
            source: node.id,
            target: `nc-${catMatch.code}`,
            label: "Category Bridge",
            similarity: 70,
            type: "category",
          });
        }
      }
    });

    // 3. Duplicate Cluster Links across CPSEs
    state.clusters.forEach((cluster) => {
      if (cluster.similarity >= similarityThreshold) {
        const clusterMembers = cluster.memberIds
          .map((id) => `mat-${id}`)
          .filter((id) => nodeMap.has(id));

        for (let i = 0; i < clusterMembers.length; i++) {
          for (let j = i + 1; j < clusterMembers.length; j++) {
            links.push({
              source: clusterMembers[i],
              target: clusterMembers[j],
              label: `${Math.round(cluster.similarity)}% Duplicate`,
              similarity: cluster.similarity,
              type: "duplicate",
            });
          }
        }
      }
    });

    return { nodes, links, nodeMap };
  }, [state.materials, state.nationalCodes, state.clusters, selectedCpse, selectedCategory, searchFilter, similarityThreshold]);

  // Robust, Algorithmic Graph Text Semantic Discovery Engine
  const textAnalysisResult = useMemo(() => {
    const q = analyzedQuery.trim();
    if (!q) return null;

    const queryTokens = tokenize(q);
    const lower = q.toLowerCase();

    // 1. Engineering Entity Extraction
    const isBearing = lower.includes("bearing") || lower.includes("ball") || lower.includes("roller");
    const isValve = lower.includes("valve") || lower.includes("gate") || lower.includes("globe") || lower.includes("check valve");
    const isPipe = lower.includes("pipe") || lower.includes("tube") || lower.includes("casing") || lower.includes("flange");
    const isPump = lower.includes("pump") || lower.includes("impeller") || lower.includes("compressor");
    const isTransmitter = lower.includes("transmitter") || lower.includes("sensor") || lower.includes("gauge") || lower.includes("hart");
    const isMotor = lower.includes("motor") || lower.includes("transformer") || lower.includes("breaker") || lower.includes("switchgear");

    const hasRecognizedNoun = isBearing || isValve || isPipe || isPump || isTransmitter || isMotor;

    let inferredCategory: string | null = null;
    if (isBearing) inferredCategory = "Bearings & Power Transmission";
    else if (isValve) inferredCategory = "Valves & Flow Control";
    else if (isPipe) inferredCategory = "Pipes, Tubes & Fittings";
    else if (isPump) inferredCategory = "Pumps & Rotating Equipment";
    else if (isTransmitter) inferredCategory = "Instrumentation & Automation";
    else if (isMotor) inferredCategory = "Electrical Equipment & Switchgear";

    const extractedDim = lower.match(/\b(\d+mm|\d+\s*inch|\d+x\d+|\d+#|\d+m3\/h|\d+\s*bar|6205|6309|dn\d+|pn\d+)\b/i)?.[0];
    const extractedStd = lower.match(/\b(astm\s*[a-z0-9]+|din\s*\d+|c3|is\s*\d+|ss316|ss304|a105|a106|class\s*\d+|hart)\b/i)?.[0]?.toUpperCase();
    const extractedMfr = lower.match(/\b(skf|fag|bhel|yokogawa|audco|kirloskar|l&t|siemens|abb|honeywell)\b/i)?.[0]?.toUpperCase();

    const entities: { label: string; val: string; status: "extracted" | "not-found" }[] = [
      {
        label: "Primary Equipment Noun",
        val: isBearing
          ? "Ball / Roller Bearing"
          : isValve
          ? "Industrial Valve"
          : isPipe
          ? "Piping Component"
          : isPump
          ? "Rotating Impeller / Pump"
          : isTransmitter
          ? "Pressure / Flow Transmitter"
          : isMotor
          ? "Electrical Motor / Apparatus"
          : "Unrecognized / Non-standard",
        status: hasRecognizedNoun ? "extracted" : "not-found",
      },
      {
        label: "Engineering Dimensions / Sizing",
        val: extractedDim ? extractedDim.toUpperCase() : "Not specified in query",
        status: extractedDim ? "extracted" : "not-found",
      },
      {
        label: "Material Grade / Industry Standard",
        val: extractedStd || "Not specified in query",
        status: extractedStd ? "extracted" : "not-found",
      },
      {
        label: "OEM / Manufacturer Brand",
        val: extractedMfr || "Generic / Not specified",
        status: extractedMfr ? "extracted" : "not-found",
      },
    ];

    // 2. Score Candidate National Codes via Multi-Factor Semantic Overlap
    let bestNationalCode: NationalMaterialCode | null = null;
    let highestNationalScore = 0;

    if (queryTokens.length > 0) {
      state.nationalCodes.forEach((nc) => {
        const ncText = `${nc.code} ${nc.standardDescription} ${nc.category} ${nc.specificationTemplate}`.toLowerCase();
        const ncTokens = tokenize(ncText);

        // Token Jaccard overlap
        const commonTokens = queryTokens.filter((t) => ncTokens.includes(t));
        const tokenOverlapRatio = queryTokens.length > 0 ? commonTokens.length / queryTokens.length : 0;

        // Attribute matching bonuses
        let categoryBonus = 0;
        if (inferredCategory && nc.category.toLowerCase() === inferredCategory.toLowerCase()) {
          categoryBonus = 0.35;
        }

        let dimensionBonus = 0;
        if (extractedDim && ncText.includes(extractedDim.toLowerCase())) {
          dimensionBonus = 0.25;
        }

        let standardBonus = 0;
        if (extractedStd && ncText.includes(extractedStd.toLowerCase())) {
          standardBonus = 0.25;
        }

        const compositeScore = Math.min(
          tokenOverlapRatio * 0.45 + categoryBonus + dimensionBonus + standardBonus,
          0.985
        );

        if (compositeScore > highestNationalScore) {
          highestNationalScore = compositeScore;
          bestNationalCode = nc;
        }
      });
    }

    // Exact Synchronised Threshold Enforcement:
    // If composite score < CONFIDENCE_THRESHOLD_DECIMAL (0.45) or no recognized equipment noun, treat as UNRESOLVED
    const isUnresolved = highestNationalScore < CONFIDENCE_THRESHOLD_DECIMAL || !hasRecognizedNoun;
    
    // Strict sanity check: Unresolved scores are capped safely below CONFIDENCE_THRESHOLD_PCT (e.g. max 38%)
    const computedSimilarityScore = isUnresolved
      ? Math.min(Math.max(Math.round(highestNationalScore * 100 * 0.7), 8), CONFIDENCE_THRESHOLD_PCT - 5)
      : Math.round(highestNationalScore * 1000) / 10;

    // 3. Precision Multi-CPSE Duplicate Matching
    // Compute genuine similarity per material based on token overlap + spec match
    const matchingMaterialsWithScores = state.materials
      .map((mat) => {
        const matText = `${mat.cpseCode} ${mat.description} ${mat.specification || ""}`.toLowerCase();
        const matTokens = tokenize(matText);
        const overlap = queryTokens.filter((t) => matTokens.includes(t));

        if (overlap.length === 0) return { mat, score: 0 };

        // Ratio of matched query tokens
        const tokenRatio = overlap.length / Math.max(queryTokens.length, 1);
        let bonus = 0;
        if (extractedDim && matText.includes(extractedDim.toLowerCase())) bonus += 0.25;
        if (extractedStd && matText.includes(extractedStd.toLowerCase())) bonus += 0.25;
        if (extractedMfr && matText.includes(extractedMfr.toLowerCase())) bonus += 0.2;

        const score = Math.min(Math.round((tokenRatio * 0.5 + bonus) * 100), 98);
        return { mat, score };
      })
      .filter((item) => item.score >= CONFIDENCE_THRESHOLD_PCT) // Only include genuine matches above threshold
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return {
      query: q,
      category: inferredCategory || "Unclassified Domain",
      entities,
      isUnresolved,
      matchedNationalCode: isUnresolved ? null : bestNationalCode,
      matchingMaterials: matchingMaterialsWithScores,
      similarityScore: computedSimilarityScore,
    };
  }, [analyzedQuery, state.nationalCodes, state.materials]);

  // Handle Pan / Drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Material Knowledge Graph & Graph Text"
        subtitle="Semantic multi-enterprise material taxonomy network, cross-CPSE duplicate resolution, and text-to-graph intelligence."
        badges={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              <Network className="mr-1 size-3" /> Multi-Enterprise Topology
            </Badge>
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="mr-1 size-3" /> Text-to-Graph Active
            </Badge>
          </div>
        }
      />

      {/* Ground-truth Dynamic KPI Stats Banner */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard
          label="Knowledge Nodes"
          value={fmtInt(graphData.nodes.length)}
          hint={`${state.nationalCodes.length} National Masters + ${state.materials.length} CPSE Records`}
        />
        <KpiCard
          label="Semantic Edges"
          value={fmtInt(graphData.links.length)}
          hint="Harmonisation & Duplicate Relationships"
        />
        <KpiCard
          label="Connected CPSEs"
          value={kpiStats.activeCpsesCount}
          hint={selectedCpse === "ALL" ? "All Connected CPSEs in Scope" : `Filtered to ${selectedCpse}`}
        />
        <KpiCard
          label="National Mapping Rate"
          value={kpiStats.rate}
          hint={`${kpiStats.mapped} of ${kpiStats.total} active records mapped to National Master`}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
          <TabsList className="grid w-full grid-cols-2 sm:w-[400px]">
            <TabsTrigger value="graph" className="flex items-center gap-2">
              <Network className="size-4" /> Multi-CPSE Graph
            </TabsTrigger>
            <TabsTrigger value="text" className="flex items-center gap-2">
              <Sparkles className="size-4" /> Graph Text Intelligence
            </TabsTrigger>
          </TabsList>

          {activeTab === "graph" && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.min(z + 0.15, 2.5))}>
                <ZoomIn className="size-3.5" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.max(z - 0.15, 0.4))}>
                <ZoomOut className="size-3.5" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleResetZoom}>
                <RotateCcw className="size-3.5" /> Reset View
              </Button>
            </div>
          )}
        </div>

        {/* TAB 1: INTERACTIVE KNOWLEDGE GRAPH */}
        <TabsContent value="graph" className="space-y-4 pt-2">
          {/* Controls Bar */}
          <div className="grid grid-cols-1 gap-3 rounded-md border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Filter by CPSE</label>
              <Select value={selectedCpse} onValueChange={setSelectedCpse}>
                <SelectTrigger className="mt-1 h-8 text-xs">
                  <SelectValue placeholder="All CPSEs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All CPSEs (National View)</SelectItem>
                  {CPSES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.shortName} — {c.sector}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Material Category</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="mt-1 h-8 text-xs">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Search Node Code / Name</label>
              <div className="relative mt-1">
                <Search className="absolute left-2 top-2 size-3.5 text-muted-foreground" />
                <Input
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="e.g. 6205, Valve, BHEL..."
                  className="h-8 pl-7 text-xs"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-muted-foreground">Duplicate Link Threshold</span>
                <span className="font-bold text-primary">{similarityThreshold}%</span>
              </div>
              <Slider
                value={[similarityThreshold]}
                onValueChange={([v]) => setSimilarityThreshold(v)}
                min={60}
                max={100}
                step={5}
                className="mt-2.5"
              />
            </div>
          </div>

          {/* Graph Visualization Container */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* SVG Visual Canvas */}
            <div
              ref={containerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="relative col-span-1 lg:col-span-8 h-[550px] overflow-hidden rounded-md border border-border bg-slate-950 select-none cursor-grab active:cursor-grabbing shadow-inner"
            >
              {/* Background Grid */}
              <svg className="absolute inset-0 size-full pointer-events-none opacity-20">
                <defs>
                  <pattern id="graph-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                    <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#334155" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#graph-grid)" />
              </svg>

              {/* Main SVG Graph */}
              <svg className="size-full">
                <g transform={`translate(${pan.x + 30}, ${pan.y + 20}) scale(${zoom})`}>
                  {/* Graph Links */}
                  {graphData.links.map((link, idx) => {
                    const src = graphData.nodeMap.get(link.source);
                    const tgt = graphData.nodeMap.get(link.target);
                    if (!src || !tgt) return null;

                    const isDuplicate = link.type === "duplicate";
                    const isCategoryBridge = link.type === "category";

                    return (
                      <g key={`link-${idx}`}>
                        <line
                          x1={src.x}
                          y1={src.y}
                          x2={tgt.x}
                          y2={tgt.y}
                          stroke={isDuplicate ? "#F59E0B" : isCategoryBridge ? "#475569" : "#0284C7"}
                          strokeWidth={isDuplicate ? 2 : isCategoryBridge ? 1 : 1.5}
                          strokeDasharray={isDuplicate ? "4 3" : isCategoryBridge ? "2 2" : undefined}
                          strokeOpacity={isDuplicate ? 0.8 : isCategoryBridge ? 0.35 : 0.55}
                        />
                      </g>
                    );
                  })}

                  {/* Graph Nodes */}
                  {graphData.nodes.map((node) => {
                    const isSelected = selectedNode?.id === node.id;
                    const isNational = node.type === "national";

                    return (
                      <g
                        key={node.id}
                        transform={`translate(${node.x}, ${node.y})`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNode(node);
                        }}
                        className="cursor-pointer transition-transform hover:scale-110"
                      >
                        {/* Glow effect for selected node */}
                        {isSelected && (
                          <circle r={node.radius + 8} fill={node.color} opacity={0.3} className="animate-pulse" />
                        )}

                        {/* Outer boundary */}
                        <circle
                          r={node.radius}
                          fill={isNational ? "#0F172A" : node.color}
                          stroke={isNational ? "#38BDF8" : "#FFFFFF"}
                          strokeWidth={isNational ? 2.5 : 1.5}
                          className="drop-shadow-md"
                        />

                        {/* Inner icon/text */}
                        {isNational ? (
                          <text
                            textAnchor="middle"
                            dy="4"
                            fontSize="9"
                            fontWeight="bold"
                            fill="#38BDF8"
                          >
                            NM
                          </text>
                        ) : (
                          <text
                            textAnchor="middle"
                            dy="3"
                            fontSize="8"
                            fontWeight="bold"
                            fill="#FFFFFF"
                          >
                            {node.cpseId || "ITM"}
                          </text>
                        )}

                        {/* Node Label Text */}
                        <text
                          y={node.radius + 12}
                          textAnchor="middle"
                          fontSize="10"
                          fontWeight={isNational ? "bold" : "500"}
                          fill={isNational ? "#38BDF8" : "#E2E8F0"}
                          className="pointer-events-none drop-shadow"
                        >
                          {node.label.length > 18 ? `${node.label.slice(0, 16)}...` : node.label}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>

              {/* Canvas Overlay Info / Legend */}
              <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2 rounded-md bg-slate-900/85 backdrop-blur-md px-3 py-1.5 text-[11px] text-slate-200 border border-slate-700/60 shadow">
                <span className="font-semibold text-slate-400">Legend:</span>
                <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-[#0284C7] ring-1 ring-white/50" /> National Master</span>
                <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-[#3B82F6]" /> BHEL</span>
                <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-[#EF4444]" /> ONGC</span>
                <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-[#8B5CF6]" /> SAIL</span>
                <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-[#10B981]" /> NTPC</span>
                <span className="flex items-center gap-1"><span className="h-0.5 w-3 border-t-2 border-dashed border-amber-400" /> Duplicate Link</span>
              </div>
            </div>

            {/* Node Inspector Drawer */}
            <div className="col-span-1 lg:col-span-4 flex flex-col h-[550px] rounded-md border border-border bg-card p-4 overflow-y-auto">
              <div className="border-b border-border pb-3">
                <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <Info className="size-4 text-primary" /> Entity Inspector
                </h3>
                <p className="text-xs text-muted-foreground">
                  Select any node on the canvas to inspect master relationships & duplicate clusters.
                </p>
              </div>

              {selectedNode ? (
                <div className="space-y-4 pt-3 text-xs">
                  <div className="flex items-center justify-between">
                    <Badge variant={selectedNode.type === "national" ? "default" : "secondary"}>
                      {selectedNode.type === "national" ? "National Master Code" : `CPSE Record (${selectedNode.cpseId})`}
                    </Badge>
                    <span className="font-mono text-muted-foreground">{selectedNode.id}</span>
                  </div>

                  <div>
                    <span className="font-semibold text-muted-foreground">Code / Identifier:</span>
                    <p className="font-mono text-sm font-bold text-foreground mt-0.5">{selectedNode.label}</p>
                  </div>

                  <div>
                    <span className="font-semibold text-muted-foreground">Standard Description:</span>
                    <p className="text-foreground mt-0.5 font-medium">{selectedNode.sublabel}</p>
                  </div>

                  {selectedNode.category && (
                    <div>
                      <span className="font-semibold text-muted-foreground">Category Taxonomy:</span>
                      <p className="text-foreground mt-0.5">{selectedNode.category}</p>
                    </div>
                  )}

                  {selectedNode.data?.specification && (
                    <div>
                      <span className="font-semibold text-muted-foreground">Engineering Specs:</span>
                      <p className="text-muted-foreground mt-0.5 font-mono text-[11px] bg-muted/40 p-2 rounded">
                        {selectedNode.data.specification}
                      </p>
                    </div>
                  )}

                  {selectedNode.data?.status && (
                    <div>
                      <span className="font-semibold text-muted-foreground">Governance Status:</span>
                      <div className="mt-1">
                        <StatusBadge status={selectedNode.data.status} />
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-border flex flex-col gap-2">
                    {selectedNode.type === "national" ? (
                      <Button
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => navigate({ to: "/national-codes" })}
                      >
                        <Database className="mr-1.5 size-3.5" /> View in National Registry
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => navigate({ to: `/materials/${selectedNode.data.id}` })}
                        >
                          <ExternalLink className="mr-1.5 size-3.5" /> Open Material Record
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => navigate({ to: "/harmonize" })}
                        >
                          <GitFork className="mr-1.5 size-3.5" /> Harmonize in Cluster View
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                  <Network className="size-10 text-muted-foreground/40 mb-2" />
                  <p className="font-medium text-xs text-foreground">No node selected</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Click any node in the graph above to inspect CPSE duplicates and mapping chains.
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: GRAPH TEXT INTELLIGENCE */}
        <TabsContent value="text" className="space-y-6 pt-2">
          {/* Query Bar */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="size-4 text-primary" /> Text-to-Graph Semantic Discovery Engine
              </CardTitle>
              <CardDescription className="text-xs">
                Enter any unstructured CPSE material description, purchase order text, or legacy ERP line item.
                The engine extracts engineering dimensions, resolves entities, and dynamically computes semantic similarity.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    value={textQuery}
                    onChange={(e) => setTextQuery(e.target.value)}
                    placeholder="Enter material description e.g. Deep groove ball bearing 6205 2RS C3 SKF..."
                    className="pl-9"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setAnalyzedQuery(textQuery);
                    }}
                  />
                </div>
                <Button onClick={() => setAnalyzedQuery(textQuery)}>
                  <Sparkles className="mr-1.5 size-4" /> Run Graph Text Analysis
                </Button>
              </div>

              {/* Query Presets */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-semibold text-muted-foreground">Try Presets:</span>
                {PRESET_QUERIES.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setTextQuery(preset);
                      setAnalyzedQuery(preset);
                    }}
                    className="rounded-sm border border-border bg-surface px-2 py-0.5 text-[11px] text-foreground hover:bg-accent transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Analysis Results & Subgraph Visual */}
          {textAnalysisResult && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Entity Breakdown */}
              <div className="col-span-1 lg:col-span-5 space-y-4">
                <Card>
                  <CardHeader className="pb-3 border-b border-border">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Tag className="size-4 text-primary" /> Extracted Entities & Attributes
                      </CardTitle>
                      <Badge
                        className={
                          textAnalysisResult.isUnresolved
                            ? "bg-amber-600/90 text-white text-[10px]"
                            : "bg-emerald-600 text-white text-[10px]"
                        }
                      >
                        {textAnalysisResult.similarityScore}% Confidence
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-3 space-y-2.5">
                    {textAnalysisResult.entities.map((item, idx) => (
                      <div key={`${item.label}-${idx}`} className="flex items-center justify-between border-b border-border/60 pb-1.5 text-xs">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span
                          className={`font-semibold font-mono ${
                            item.status === "not-found" ? "text-amber-500 italic" : "text-foreground"
                          }`}
                        >
                          {item.val}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-b border-border/60 pb-1.5 text-xs">
                      <span className="text-muted-foreground">Classified Segment</span>
                      <span className="font-semibold text-primary">{textAnalysisResult.category}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Best Matched National Code OR Honest Unresolved State */}
                {textAnalysisResult.matchedNationalCode ? (
                  <Card className="border-primary/40 bg-primary/5">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-primary">
                          Resolved National Master Code
                        </span>
                        <CheckCircle2 className="size-4 text-primary" />
                      </div>
                      <CardTitle className="text-base font-mono">
                        {textAnalysisResult.matchedNationalCode.code}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                      <p className="font-medium text-foreground">
                        {textAnalysisResult.matchedNationalCode.standardDescription}
                      </p>
                      <p className="text-muted-foreground">
                        {textAnalysisResult.matchedNationalCode.specificationTemplate}
                      </p>
                      <div className="pt-2">
                        <Button
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => {
                            toast.success(`Linked query to ${textAnalysisResult.matchedNationalCode?.code}`);
                            navigate({ to: "/national-codes" });
                          }}
                        >
                          Adopt National Master Code
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-amber-500/40 bg-amber-500/5">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                          Unresolved / Low Confidence Match
                        </span>
                        <AlertTriangle className="size-4 text-amber-500" />
                      </div>
                      <CardTitle className="text-base text-foreground flex items-center gap-1.5">
                        <FileQuestion className="size-4 text-amber-500" /> No Definitive Master Code
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                      <p className="text-muted-foreground">
                        No authoritative National Material Master code exceeds the {CONFIDENCE_THRESHOLD_PCT}% confidence threshold for this query. The query lacks sufficient engineering parameters or standard taxonomy keywords.
                      </p>
                      <div className="pt-2 flex flex-col gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs border-amber-500/40 hover:bg-amber-500/10"
                          onClick={() => {
                            toast.info("Opened National Code Creation Draft for engineering review.");
                            navigate({ to: "/national-codes" });
                          }}
                        >
                          Draft New National Master Specification
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Discovered Multi-CPSE Duplicates in Graph */}
              <div className="col-span-1 lg:col-span-7 space-y-4">
                <Card>
                  <CardHeader className="pb-3 border-b border-border">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Boxes className="size-4 text-primary" /> Discovered Cross-CPSE Matches & Duplicates ({textAnalysisResult.matchingMaterials.length})
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Existing enterprise material master records filtered by computed textual & engineering similarity:
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {textAnalysisResult.matchingMaterials.length > 0 ? (
                      <div className="divide-y divide-border">
                        {textAnalysisResult.matchingMaterials.map(({ mat, score }) => (
                          <div key={mat.id} className="p-3 hover:bg-surface/50 transition-colors flex items-center justify-between gap-3 text-xs">
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono text-[10px] bg-background">
                                  {mat.cpseId} · {mat.cpseCode}
                                </Badge>
                                <Badge
                                  variant="secondary"
                                  className={
                                    score >= 80
                                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-mono text-[10px]"
                                      : "bg-amber-500/15 text-amber-700 dark:text-amber-400 font-mono text-[10px]"
                                  }
                                >
                                  {score}% Similarity
                                </Badge>
                                <StatusBadge status={mat.status} />
                              </div>
                              <p className="font-medium text-foreground truncate">{mat.description}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{mat.specification}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs"
                              onClick={() => navigate({ to: `/materials/${mat.id}` })}
                            >
                              <ArrowRight className="size-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-center text-xs text-muted-foreground space-y-1">
                        <FileQuestion className="size-8 mx-auto text-muted-foreground/50 mb-1" />
                        <p className="font-medium text-foreground">No Duplicate Records Found</p>
                        <p className="text-[11px]">No existing CPSE master records matched this query above the {CONFIDENCE_THRESHOLD_PCT}% similarity threshold.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Direct Action Hub */}
                <div className="rounded-md border border-border bg-card p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">
                      {textAnalysisResult.matchingMaterials.length > 0
                        ? "Need to harmonize these discovered records?"
                        : "Ready to catalog this material?"}
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      {textAnalysisResult.matchingMaterials.length > 0
                        ? "Dispatch these discovered CPSE records into the Harmonisation Workflow for consensus review."
                        : "Create a standardized material entry under the national taxonomy framework."}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (textAnalysisResult.matchingMaterials.length > 0) {
                        toast.success("Query records queued for national harmonisation!");
                        navigate({ to: "/harmonize" });
                      } else {
                        toast.success("Navigating to Material Master Catalog");
                        navigate({ to: "/materials" });
                      }
                    }}
                  >
                    <GitFork className="mr-1.5 size-3.5" />{" "}
                    {textAnalysisResult.matchingMaterials.length > 0
                      ? "Launch Harmonisation Batch"
                      : "Open Material Master"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Simulated REST layer.
 *
 * Every module talks to these service objects instead of touching the
 * dataset directly. The transport is in-memory with artificial latency so
 * the mock layer can later be swapped for real HTTP calls (the request /
 * response shapes are already REST-shaped).
 */
import type {
  AuditEvent,
  DuplicateCluster,
  GovernanceIssue,
  Integration,
  Mapping,
  Material,
  MigrationBatch,
  NationalCode,
} from "@/data/types";

export const latency = (min = 180, max = 520) =>
  new Promise<void>((resolve) => setTimeout(resolve, min + Math.random() * (max - min)));

export interface Page<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MaterialQuery {
  search?: string;
  cpseIds?: string[];
  categories?: string[];
  statuses?: string[];
  approval?: string[];
  uoms?: string[];
  minConfidence?: number;
  sortBy?: keyof Material;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

const norm = (v: unknown) => String(v ?? "").toLowerCase();

export const materialService = {
  /** GET /materials */
  async list(all: Material[], q: MaterialQuery): Promise<Page<Material>> {
    await latency(140, 380);
    let rows = all;
    if (q.search?.trim()) {
      const terms = q.search.toLowerCase().split(/\s+/).filter(Boolean);
      rows = rows.filter((m) => {
        const hay = [
          m.cpseCode,
          m.nationalCode,
          m.description,
          m.standardDescription,
          m.category,
          m.subCategory,
          m.specification,
          m.manufacturer,
          m.uom,
        ]
          .map(norm)
          .join(" | ");
        return terms.every((t) => hay.includes(t));
      });
    }
    if (q.cpseIds?.length) rows = rows.filter((m) => q.cpseIds!.includes(m.cpseId));
    if (q.categories?.length) rows = rows.filter((m) => q.categories!.includes(m.category));
    if (q.statuses?.length) rows = rows.filter((m) => q.statuses!.includes(m.status));
    if (q.approval?.length) rows = rows.filter((m) => q.approval!.includes(m.approvalStatus));
    if (q.uoms?.length) rows = rows.filter((m) => q.uoms!.includes(m.uom));
    if (q.minConfidence) rows = rows.filter((m) => (m.confidence ?? 0) >= q.minConfidence!);

    const sortBy = q.sortBy ?? "cpseCode";
    const dir = q.sortDir === "desc" ? -1 : 1;
    rows = [...rows].sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      if (typeof av === "number" || typeof bv === "number") {
        return ((Number(av) || 0) - (Number(bv) || 0)) * dir;
      }
      return norm(av).localeCompare(norm(bv)) * dir;
    });

    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 25;
    return {
      rows: rows.slice((page - 1) * pageSize, page * pageSize),
      total: rows.length,
      page,
      pageSize,
    };
  },

  /** GET /materials/:id */
  async get(all: Material[], id: string): Promise<Material | undefined> {
    await latency(120, 300);
    return all.find((m) => m.id === id || m.cpseCode === id);
  },
};

export const matchingService = {
  /** GET /matches */
  async list(clusters: DuplicateCluster[], filters: { statuses?: string[]; matchTypes?: string[]; category?: string; search?: string }) {
    await latency();
    let rows = clusters;
    if (filters.statuses?.length) rows = rows.filter((c) => filters.statuses!.includes(c.status));
    if (filters.matchTypes?.length) rows = rows.filter((c) => filters.matchTypes!.includes(c.matchType));
    if (filters.category && filters.category !== "all") rows = rows.filter((c) => c.category === filters.category);
    if (filters.search?.trim()) {
      const t = filters.search.toLowerCase();
      rows = rows.filter(
        (c) =>
          c.id.toLowerCase().includes(t) ||
          c.recommendation.nationalCode.toLowerCase().includes(t) ||
          c.recommendation.standardDescription.toLowerCase().includes(t),
      );
    }
    return rows;
  },
  /** POST /matches/:id/approve|reject|review */
  async transition(id: string, action: string) {
    await latency(420, 900);
    return { id, action, at: new Date().toISOString() };
  },
};

export const duplicateService = {
  /** GET /duplicates */
  async list(clusters: DuplicateCluster[]) {
    await latency();
    return clusters;
  },
  /** POST /duplicates/scan */
  async scan() {
    await latency(900, 1600);
    return { scanned: 560, clustersFound: 118, at: new Date().toISOString() };
  },
};

export const mappingService = {
  /** GET /mappings */
  async list(mappings: Mapping[]) {
    await latency();
    return mappings;
  },
  /** POST /mappings, PUT /mappings/:id, DELETE /mappings/:id */
  async write(op: "create" | "update" | "delete" | "approve", payload: unknown) {
    await latency(360, 800);
    return { op, payload };
  },
};

export const codeService = {
  /** POST /national-codes */
  async generate(prefix: string, seq: number): Promise<string> {
    await latency(500, 950);
    return `NUMM-${prefix}-${String(seq).padStart(6, "0")}`;
  },
  async list(codes: NationalCode[]) {
    await latency();
    return codes;
  },
};

export const migrationService = {
  async list(batches: MigrationBatch[]) {
    await latency();
    return batches;
  },
  /** POST /migration/validate */
  async validate(records: number) {
    await latency(900, 1500);
    const errors = Math.round(records * 0.017);
    const duplicates = Math.round(records * 0.061);
    return { records, valid: records - errors, errors, duplicates, missingFields: Math.round(records * 0.009) };
  },
  /** POST /migration/start */
  async execute(onProgress: (pct: number) => void) {
    for (let p = 12; p <= 100; p += Math.round(6 + Math.random() * 12)) {
      await latency(160, 320);
      onProgress(Math.min(100, p));
    }
    onProgress(100);
    return { status: "completed" as const, at: new Date().toISOString() };
  },
};

export const analyticsService = {
  async load<T>(compute: () => T): Promise<T> {
    await latency(240, 620);
    return compute();
  },
};

export const auditService = {
  async list(events: AuditEvent[]) {
    await latency();
    return events;
  },
};

export const governanceService = {
  async list(issues: GovernanceIssue[]) {
    await latency();
    return issues;
  },
  async resolve(id: string) {
    await latency(320, 700);
    return { id };
  },
};

export const integrationService = {
  async list(items: Integration[]) {
    await latency();
    return items;
  },
  async test(id: string) {
    await latency(800, 1500);
    return { id, ok: true, roundTripMs: Math.round(80 + Math.random() * 240) };
  },
  async sync(id: string) {
    await latency(1200, 2200);
    return { id, imported: Math.round(400 + Math.random() * 4200), errors: Math.round(Math.random() * 8) };
  },
};

export const notificationService = {
  async markRead(id: string) {
    await latency(80, 180);
    return { id };
  },
};

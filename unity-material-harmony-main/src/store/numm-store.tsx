"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import { CPSES, DATASET, USERS } from "@/data/dataset";
import type {
  AppNotification,
  AuditEvent,
  ClassificationNode,
  DuplicateCluster,
  GovernanceIssue,
  Integration,
  Mapping,
  Material,
  MigrationBatch,
  NationalCode,
  TrendPoint,
} from "@/data/types";

export interface SessionUser {
  name: string;
  role: string;
}

export interface NummState {
  materials: Material[];
  clusters: DuplicateCluster[];
  nationalCodes: NationalCode[];
  mappings: Mapping[];
  audit: AuditEvent[];
  notifications: AppNotification[];
  integrations: Integration[];
  governance: GovernanceIssue[];
  migrations: MigrationBatch[];
  classification: ClassificationNode[];
  trend: TrendPoint[];
  user: SessionUser;
  activeCpse: string; // "ALL" or cpse id
  codeSeq: number;
  sessionActions: number;
}

type Action =
  | { type: "audit"; event: Omit<AuditEvent, "id" | "timestamp"> }
  | { type: "notify"; notification: Omit<AppNotification, "id" | "timestamp" | "read" | "dismissed"> }
  | { type: "notification/read"; id: string }
  | { type: "notification/readAll" }
  | { type: "notification/dismiss"; id: string }
  | { type: "notification/unread"; id: string }
  | { type: "user/role"; role: string }
  | { type: "user/switch"; user: SessionUser }
  | { type: "cpse/active"; id: string }
  | {
      type: "cluster/approve";
      id: string;
      reason: string;
      overrides?: { nationalCode?: string; standardDescription?: string; uom?: string; category?: string };
      actor: SessionUser;
    }
  | { type: "cluster/reject"; id: string; reason: string; actor: SessionUser }
  | { type: "cluster/review"; id: string; reviewer: string; note: string; actor: SessionUser }
  | { type: "cluster/status"; id: string; status: DuplicateCluster["status"]; reason: string; actor: SessionUser }
  | { type: "cluster/comment"; id: string; body: string; kind: "comment" | "clarification" | "decision"; actor: SessionUser }
  | {
      type: "material/standardize";
      id: string;
      standardDescription: string;
      attributes: Record<string, string>;
      uom: string;
      reason: string;
      submit: boolean;
      actor: SessionUser;
    }
  | { type: "material/category"; id: string; path: string[]; category: string; subCategory: string; actor: SessionUser }
  | { type: "material/bulkStatus"; ids: string[]; status: Material["status"]; reason: string; actor: SessionUser }
  | { type: "mapping/add"; mapping: Omit<Mapping, "id">; actor: SessionUser }
  | { type: "mapping/update"; id: string; patch: Partial<Mapping>; reason: string; actor: SessionUser }
  | { type: "mapping/remove"; id: string; reason: string; actor: SessionUser }
  | { type: "mapping/approve"; ids: string[]; actor: SessionUser }
  | { type: "code/create"; code: NationalCode; actor: SessionUser }
  | { type: "code/patch"; id: string; patch: Partial<NationalCode> }
  | { type: "classification/create"; parentId: string | null; name: string; actor: SessionUser }
  | { type: "migration/upsert"; batch: MigrationBatch; actor: SessionUser; reason?: string }
  | { type: "migration/progress"; id: string; progress: number; status?: MigrationBatch["status"] }
  | { type: "integration/patch"; id: string; patch: Partial<Integration>; log?: Integration["logs"][number] }
  | { type: "governance/status"; id: string; status: GovernanceIssue["status"]; actor: SessionUser };

const nowIso = () => new Date().toISOString();
const nextId = (prefix: string, n: number, w = 5) => `${prefix}-${String(n + 1).padStart(w, "0")}`;

function withAudit(state: NummState, event: Omit<AuditEvent, "id" | "timestamp">): AuditEvent[] {
  return [
    { ...event, id: nextId("AUD", state.audit.length + 900), timestamp: nowIso() },
    ...state.audit,
  ];
}

function pushNotification(
  state: NummState,
  n: Omit<AppNotification, "id" | "timestamp" | "read" | "dismissed">,
): AppNotification[] {
  return [
    { ...n, id: nextId("NTF", state.notifications.length + 100, 3), timestamp: nowIso(), read: false, dismissed: false },
    ...state.notifications,
  ];
}

function reducer(state: NummState, action: Action): NummState {
  switch (action.type) {
    case "audit":
      return { ...state, audit: withAudit(state, action.event) };

    case "notify":
      return { ...state, notifications: pushNotification(state, action.notification) };

    case "notification/read":
      return {
        ...state,
        notifications: state.notifications.map((n) => (n.id === action.id ? { ...n, read: true } : n)),
      };
    case "notification/unread":
      return {
        ...state,
        notifications: state.notifications.map((n) => (n.id === action.id ? { ...n, read: false } : n)),
      };
    case "notification/readAll":
      return { ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) };
    case "notification/dismiss":
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          n.id === action.id ? { ...n, dismissed: true, read: true } : n,
        ),
      };

    case "user/role":
      return { ...state, user: { ...state.user, role: action.role } };
    case "user/switch":
      return { ...state, user: action.user };
    case "cpse/active":
      return { ...state, activeCpse: action.id };

    case "cluster/approve": {
      const cluster = state.clusters.find((c) => c.id === action.id);
      if (!cluster) return state;
      const rec = {
        ...cluster.recommendation,
        ...(action.overrides?.nationalCode ? { nationalCode: action.overrides.nationalCode } : {}),
        ...(action.overrides?.standardDescription
          ? { standardDescription: action.overrides.standardDescription }
          : {}),
        ...(action.overrides?.uom ? { uom: action.overrides.uom } : {}),
        ...(action.overrides?.category ? { category: action.overrides.category } : {}),
      };
      const members = state.materials.filter((m) => cluster.memberIds.includes(m.id));
      const newMappings: Mapping[] = members
        .filter((m) => !state.mappings.some((x) => x.materialId === m.id && x.nationalCode === rec.nationalCode))
        .map((m, i) => ({
          id: nextId("MAP", state.mappings.length + i, 5),
          nationalCode: rec.nationalCode,
          cpseId: m.cpseId,
          cpseCode: m.cpseCode,
          materialId: m.id,
          status: "active",
          mappedOn: nowIso(),
          approvedBy: action.actor.name,
        }));

      const existingCode = state.nationalCodes.find((c) => c.clusterId === cluster.id);
      const codeRecord: NationalCode = existingCode
        ? {
            ...existingCode,
            code: rec.nationalCode,
            standardDescription: rec.standardDescription,
            uom: rec.uom,
            category: rec.category,
            status: "active",
            mappedCpses: [...new Set(members.map((m) => m.cpseId))],
            mappedLegacyCodes: members.length,
            approvedOn: nowIso(),
            approvedBy: action.actor.name,
          }
        : {
            id: nextId("NC", state.nationalCodes.length + 400),
            code: rec.nationalCode,
            standardDescription: rec.standardDescription,
            category: rec.category,
            uom: rec.uom,
            status: "active",
            mappedCpses: [...new Set(members.map((m) => m.cpseId))],
            mappedLegacyCodes: members.length,
            approvedOn: nowIso(),
            approvedBy: action.actor.name,
            clusterId: cluster.id,
          };

      const next: NummState = {
        ...state,
        clusters: state.clusters.map((c) =>
          c.id === cluster.id
            ? {
                ...c,
                status: "approved",
                reviewer: action.actor.name,
                recommendation: rec,
                comments: [
                  ...c.comments,
                  {
                    id: `CMT-${c.id}-${c.comments.length + 1}`,
                    author: action.actor.name,
                    role: action.actor.role,
                    timestamp: nowIso(),
                    body: `Approved. ${action.reason}`,
                    kind: "decision",
                  },
                ],
              }
            : c,
        ),
        materials: state.materials.map((m) =>
          cluster.memberIds.includes(m.id)
            ? {
                ...m,
                status: "mapped",
                approvalStatus: "approved",
                standardDescription: rec.standardDescription,
                nationalCode: rec.nationalCode,
                uom: rec.uom,
                lastUpdated: nowIso(),
                lifecycle: "Active",
              }
            : m,
        ),
        mappings: [...newMappings, ...state.mappings],
        nationalCodes: existingCode
          ? state.nationalCodes.map((c) => (c.id === existingCode.id ? codeRecord : c))
          : [codeRecord, ...state.nationalCodes],
        sessionActions: state.sessionActions + 1,
      };
      next.audit = withAudit(next, {
        user: action.actor.name,
        role: action.actor.role,
        action: "Approved harmonisation recommendation",
        entity: cluster.id,
        previousValue: `${cluster.status} · ${cluster.memberIds.length} legacy codes`,
        newValue: `${rec.nationalCode} · Approved`,
        reason: action.reason,
        status: "success",
      });
      next.notifications = pushNotification(next, {
        title: `National code ${rec.nationalCode} approved`,
        body: `${members.length} CPSE codes mapped and activated by ${action.actor.name}.`,
        kind: "mapping",
        link: "/mapping",
      });
      return next;
    }

    case "cluster/reject": {
      const cluster = state.clusters.find((c) => c.id === action.id);
      if (!cluster) return state;
      const next: NummState = {
        ...state,
        clusters: state.clusters.map((c) =>
          c.id === action.id
            ? {
                ...c,
                status: "rejected",
                reviewer: action.actor.name,
                comments: [
                  ...c.comments,
                  {
                    id: `CMT-${c.id}-${c.comments.length + 1}`,
                    author: action.actor.name,
                    role: action.actor.role,
                    timestamp: nowIso(),
                    body: `Rejected. ${action.reason}`,
                    kind: "decision",
                  },
                ],
              }
            : c,
        ),
        materials: state.materials.map((m) =>
          cluster.memberIds.includes(m.id)
            ? { ...m, status: "unstandardized", approvalStatus: "rejected", nationalCode: null, lastUpdated: nowIso() }
            : m,
        ),
        sessionActions: state.sessionActions + 1,
      };
      next.audit = withAudit(next, {
        user: action.actor.name,
        role: action.actor.role,
        action: "Rejected harmonisation recommendation",
        entity: action.id,
        previousValue: cluster.status,
        newValue: "Rejected",
        reason: action.reason,
        status: "warning",
      });
      return next;
    }

    case "cluster/review": {
      const cluster = state.clusters.find((c) => c.id === action.id);
      if (!cluster) return state;
      const next: NummState = {
        ...state,
        clusters: state.clusters.map((c) =>
          c.id === action.id
            ? {
                ...c,
                status: "under-review",
                reviewer: action.reviewer,
                comments: [
                  ...c.comments,
                  {
                    id: `CMT-${c.id}-${c.comments.length + 1}`,
                    author: action.actor.name,
                    role: action.actor.role,
                    timestamp: nowIso(),
                    body: action.note || `Assigned to ${action.reviewer} for engineering review.`,
                    kind: "clarification",
                  },
                ],
              }
            : c,
        ),
        materials: state.materials.map((m) =>
          cluster.memberIds.includes(m.id)
            ? { ...m, status: "under-review", approvalStatus: "pending", lastUpdated: nowIso() }
            : m,
        ),
        sessionActions: state.sessionActions + 1,
      };
      next.audit = withAudit(next, {
        user: action.actor.name,
        role: action.actor.role,
        action: "Assigned reviewer",
        entity: action.id,
        previousValue: cluster.reviewer ?? "Unassigned",
        newValue: action.reviewer,
        reason: action.note || "Engineering validation required",
        status: "info",
      });
      next.notifications = pushNotification(next, {
        title: `Review assigned: ${action.id}`,
        body: `${action.reviewer} must validate specifications for ${cluster.memberIds.length} records.`,
        kind: "review",
        link: "/harmonize",
      });
      return next;
    }

    case "cluster/status": {
      const cluster = state.clusters.find((c) => c.id === action.id);
      if (!cluster) return state;
      const next: NummState = {
        ...state,
        clusters: state.clusters.map((c) => (c.id === action.id ? { ...c, status: action.status } : c)),
        sessionActions: state.sessionActions + 1,
      };
      next.audit = withAudit(next, {
        user: action.actor.name,
        role: action.actor.role,
        action:
          action.status === "kept-separate"
            ? "Marked cluster as distinct materials"
            : action.status === "dismissed"
              ? "Dismissed duplicate cluster"
              : `Cluster status set to ${action.status}`,
        entity: action.id,
        previousValue: cluster.status,
        newValue: action.status,
        reason: action.reason,
        status: "info",
      });
      return next;
    }

    case "cluster/comment": {
      const next: NummState = {
        ...state,
        clusters: state.clusters.map((c) =>
          c.id === action.id
            ? {
                ...c,
                comments: [
                  ...c.comments,
                  {
                    id: `CMT-${c.id}-${c.comments.length + 1}`,
                    author: action.actor.name,
                    role: action.actor.role,
                    timestamp: nowIso(),
                    body: action.body,
                    kind: action.kind,
                  },
                ],
              }
            : c,
        ),
      };
      next.audit = withAudit(next, {
        user: action.actor.name,
        role: action.actor.role,
        action: action.kind === "clarification" ? "Requested clarification" : "Added review comment",
        entity: action.id,
        previousValue: "—",
        newValue: action.body.slice(0, 60),
        reason: "Review collaboration",
        status: "info",
      });
      return next;
    }

    case "material/standardize": {
      const mat = state.materials.find((m) => m.id === action.id);
      if (!mat) return state;
      const next: NummState = {
        ...state,
        materials: state.materials.map((m) =>
          m.id === action.id
            ? {
                ...m,
                standardDescription: action.standardDescription,
                attributes: action.attributes,
                uom: action.uom,
                status: action.submit ? "under-review" : "standardized",
                approvalStatus: action.submit ? "pending" : m.approvalStatus,
                dataQuality: Math.min(100, Math.max(m.dataQuality, 88)),
                lastUpdated: nowIso(),
                version: bumpVersion(m.version),
              }
            : m,
        ),
        sessionActions: state.sessionActions + 1,
      };
      next.audit = withAudit(next, {
        user: action.actor.name,
        role: action.actor.role,
        action: action.submit ? "Submitted standardisation for approval" : "Changed standard description",
        entity: mat.cpseCode,
        previousValue: mat.standardDescription ?? mat.description,
        newValue: action.standardDescription,
        reason: action.reason,
        status: "success",
      });
      if (action.submit) {
        next.notifications = pushNotification(next, {
          title: "Standardisation submitted",
          body: `${mat.cpseCode} standard description submitted for approval.`,
          kind: "review",
          link: "/standardization",
        });
      }
      return next;
    }

    case "material/category": {
      const mat = state.materials.find((m) => m.id === action.id);
      if (!mat) return state;
      const next: NummState = {
        ...state,
        materials: state.materials.map((m) =>
          m.id === action.id
            ? {
                ...m,
                classificationPath: action.path,
                category: action.category,
                subCategory: action.subCategory,
                lastUpdated: nowIso(),
              }
            : m,
        ),
        sessionActions: state.sessionActions + 1,
      };
      next.audit = withAudit(next, {
        user: action.actor.name,
        role: action.actor.role,
        action: "Reassigned classification",
        entity: mat.cpseCode,
        previousValue: mat.classificationPath.join(" › "),
        newValue: action.path.join(" › "),
        reason: "Classification harmonisation",
        status: "success",
      });
      return next;
    }

    case "material/bulkStatus": {
      const next: NummState = {
        ...state,
        materials: state.materials.map((m) =>
          action.ids.includes(m.id)
            ? {
                ...m,
                status: action.status,
                approvalStatus: action.status === "under-review" ? "pending" : m.approvalStatus,
                lastUpdated: nowIso(),
              }
            : m,
        ),
        sessionActions: state.sessionActions + 1,
      };
      next.audit = withAudit(next, {
        user: action.actor.name,
        role: action.actor.role,
        action: `Bulk status update (${action.ids.length} records)`,
        entity: action.ids.slice(0, 3).join(", ") + (action.ids.length > 3 ? ` +${action.ids.length - 3}` : ""),
        previousValue: "mixed",
        newValue: action.status,
        reason: action.reason,
        status: "info",
      });
      return next;
    }

    case "mapping/add": {
      const next: NummState = {
        ...state,
        mappings: [
          { ...action.mapping, id: nextId("MAP", state.mappings.length + 700) },
          ...state.mappings,
        ],
        nationalCodes: state.nationalCodes.map((c) =>
          c.code === action.mapping.nationalCode
            ? {
                ...c,
                mappedLegacyCodes: c.mappedLegacyCodes + 1,
                mappedCpses: [...new Set([...c.mappedCpses, action.mapping.cpseId])],
              }
            : c,
        ),
        materials: state.materials.map((m) =>
          m.id === action.mapping.materialId
            ? {
                ...m,
                nationalCode: action.mapping.nationalCode,
                status: action.mapping.status === "active" ? "mapped" : m.status,
                lastUpdated: nowIso(),
              }
            : m,
        ),
        sessionActions: state.sessionActions + 1,
      };
      next.audit = withAudit(next, {
        user: action.actor.name,
        role: action.actor.role,
        action: "Added CPSE mapping",
        entity: action.mapping.cpseCode,
        previousValue: "Unmapped",
        newValue: action.mapping.nationalCode,
        reason: action.mapping.note ?? "Legacy code rationalisation",
        status: "success",
      });
      return next;
    }

    case "mapping/update": {
      const before = state.mappings.find((m) => m.id === action.id);
      if (!before) return state;
      const next: NummState = {
        ...state,
        mappings: state.mappings.map((m) => (m.id === action.id ? { ...m, ...action.patch } : m)),
        sessionActions: state.sessionActions + 1,
      };
      next.audit = withAudit(next, {
        user: action.actor.name,
        role: action.actor.role,
        action: "Updated CPSE mapping",
        entity: before.cpseCode,
        previousValue: `${before.nationalCode} · ${before.status}`,
        newValue: `${action.patch.nationalCode ?? before.nationalCode} · ${action.patch.status ?? before.status}`,
        reason: action.reason,
        status: "info",
      });
      return next;
    }

    case "mapping/remove": {
      const before = state.mappings.find((m) => m.id === action.id);
      if (!before) return state;
      const next: NummState = {
        ...state,
        mappings: state.mappings.filter((m) => m.id !== action.id),
        materials: state.materials.map((m) =>
          m.id === before.materialId ? { ...m, nationalCode: null, status: "standardized" } : m,
        ),
        sessionActions: state.sessionActions + 1,
      };
      next.audit = withAudit(next, {
        user: action.actor.name,
        role: action.actor.role,
        action: "Removed CPSE mapping",
        entity: before.cpseCode,
        previousValue: before.nationalCode,
        newValue: "Unmapped",
        reason: action.reason,
        status: "warning",
      });
      return next;
    }

    case "mapping/approve": {
      const next: NummState = {
        ...state,
        mappings: state.mappings.map((m) =>
          action.ids.includes(m.id)
            ? { ...m, status: "active", approvedBy: action.actor.name, mappedOn: nowIso() }
            : m,
        ),
        sessionActions: state.sessionActions + 1,
      };
      next.audit = withAudit(next, {
        user: action.actor.name,
        role: action.actor.role,
        action: `Approved ${action.ids.length} CPSE mapping(s)`,
        entity: action.ids.join(", ").slice(0, 60),
        previousValue: "Pending",
        newValue: "Active",
        reason: "Mapping governance approval",
        status: "success",
      });
      return next;
    }

    case "code/create": {
      const next: NummState = {
        ...state,
        nationalCodes: [action.code, ...state.nationalCodes],
        codeSeq: state.codeSeq + 1,
        sessionActions: state.sessionActions + 1,
      };
      next.audit = withAudit(next, {
        user: action.actor.name,
        role: action.actor.role,
        action: "Created national material code",
        entity: action.code.code,
        previousValue: "—",
        newValue: `${action.code.code} · ${action.code.standardDescription}`,
        reason: "National code generation",
        status: "success",
      });
      return next;
    }

    case "code/patch":
      return {
        ...state,
        nationalCodes: state.nationalCodes.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c)),
      };

    case "classification/create": {
      const node: ClassificationNode = {
        id: `${action.parentId ?? "ROOT"}/${action.name}`,
        name: action.name,
        level: 0,
        children: [],
      };
      const insert = (nodes: ClassificationNode[], level: number): ClassificationNode[] =>
        nodes.map((n) =>
          n.id === action.parentId
            ? { ...n, children: [...n.children, { ...node, level: level + 1 }] }
            : { ...n, children: insert(n.children, level + 1) },
        );
      const next: NummState = {
        ...state,
        classification: action.parentId
          ? insert(state.classification, 0)
          : [...state.classification, node],
        sessionActions: state.sessionActions + 1,
      };
      next.audit = withAudit(next, {
        user: action.actor.name,
        role: action.actor.role,
        action: "Created classification node",
        entity: node.id,
        previousValue: "—",
        newValue: action.name,
        reason: "Classification hierarchy maintenance",
        status: "success",
      });
      return next;
    }

    case "migration/upsert": {
      const exists = state.migrations.some((b) => b.id === action.batch.id);
      const next: NummState = {
        ...state,
        migrations: exists
          ? state.migrations.map((b) => (b.id === action.batch.id ? action.batch : b))
          : [action.batch, ...state.migrations],
        sessionActions: state.sessionActions + 1,
      };
      next.audit = withAudit(next, {
        user: action.actor.name,
        role: action.actor.role,
        action: exists ? `Migration batch ${action.batch.status}` : "Created migration batch",
        entity: action.batch.id,
        previousValue: exists ? (state.migrations.find((b) => b.id === action.batch.id)?.status ?? "—") : "—",
        newValue: `${action.batch.status} · ${action.batch.mapped} mapped / ${action.batch.conflicts} conflicts`,
        reason: action.reason ?? "Legacy migration workflow",
        status: action.batch.status === "failed" ? "warning" : "success",
      });
      if (action.batch.status === "completed") {
        next.notifications = pushNotification(next, {
          title: `Migration ${action.batch.id} completed`,
          body: `${action.batch.mapped.toLocaleString("en-IN")} legacy records migrated for ${action.batch.cpseId}.`,
          kind: "migration",
          link: "/migration",
        });
      }
      return next;
    }

    case "migration/progress":
      return {
        ...state,
        migrations: state.migrations.map((b) =>
          b.id === action.id
            ? { ...b, progress: action.progress, status: action.status ?? b.status }
            : b,
        ),
      };

    case "integration/patch":
      return {
        ...state,
        integrations: state.integrations.map((i) =>
          i.id === action.id
            ? { ...i, ...action.patch, logs: action.log ? [action.log, ...i.logs] : i.logs }
            : i,
        ),
      };

    case "governance/status": {
      const issue = state.governance.find((g) => g.id === action.id);
      if (!issue) return state;
      const next: NummState = {
        ...state,
        governance: state.governance.map((g) => (g.id === action.id ? { ...g, status: action.status } : g)),
        sessionActions: state.sessionActions + 1,
      };
      next.audit = withAudit(next, {
        user: action.actor.name,
        role: action.actor.role,
        action: `Governance issue ${action.status}`,
        entity: action.id,
        previousValue: issue.status,
        newValue: action.status,
        reason: issue.type,
        status: action.status === "resolved" ? "success" : "info",
      });
      return next;
    }

    default:
      return state;
  }
}

function bumpVersion(v: string) {
  const [maj, min] = v.replace("v", "").split(".");
  return `v${maj}.${Number(min ?? 0) + 1}`;
}

const initialState: NummState = {
  materials: DATASET.materials,
  clusters: DATASET.clusters,
  nationalCodes: DATASET.nationalCodes,
  mappings: DATASET.mappings,
  audit: DATASET.audit,
  notifications: DATASET.notifications,
  integrations: DATASET.integrations,
  governance: DATASET.governance,
  migrations: DATASET.migrations,
  classification: DATASET.classification,
  trend: DATASET.trend,
  user: USERS[0]!,
  activeCpse: "ALL",
  codeSeq: 428,
  sessionActions: 0,
};

interface NummContextValue {
  state: NummState;
  dispatch: React.Dispatch<Action>;
  actor: SessionUser;
  cpseName: (id: string) => string;
  metrics: ReturnType<typeof computeMetrics>;
  can: (capability: Capability) => boolean;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export type Capability = "approve" | "edit" | "map" | "migrate" | "configure";

const CAPABILITIES: Record<string, Capability[]> = {
  "National Administrator": ["approve", "edit", "map", "migrate", "configure"],
  "Material Master Governance Officer": ["approve", "edit", "map", "migrate", "configure"],
  "CPSE Administrator": ["edit", "map", "migrate"],
  "Material Engineer": ["edit", "map"],
  "Procurement Officer": ["edit"],
  Reviewer: ["approve", "edit"],
  Auditor: [],
};

export function computeMetrics(state: NummState) {
  const scoped =
    state.activeCpse === "ALL"
      ? state.materials
      : state.materials.filter((m) => m.cpseId === state.activeCpse);

  const standardized = scoped.filter((m) => m.standardDescription).length;
  const mapped = scoped.filter((m) => m.nationalCode).length;
  const duplicateCandidates = state.clusters
    .filter((c) => ["detected", "recommended"].includes(c.status))
    .reduce((acc, c) => acc + c.memberIds.length, 0);
  const pendingReview = state.clusters.filter((c) =>
    ["detected", "recommended", "under-review"].includes(c.status),
  ).length;
  const approvedClusters = state.clusters.filter((c) => c.status === "approved").length;
  const legacyCodes = scoped.filter((m) => !m.nationalCode).length;
  const dq = scoped.length
    ? Math.round(scoped.reduce((a, m) => a + m.dataQuality, 0) / scoped.length)
    : 0;
  const rationalisation = state.clusters
    .filter((c) => ["detected", "recommended", "under-review"].includes(c.status))
    .reduce((acc, c) => acc + (c.memberIds.length - 1), 0);

  const b = DATASET.baseline;
  const delta = state.sessionActions;
  return {
    scopedCount: scoped.length,
    sampleTotal: state.materials.length,
    standardized,
    mapped,
    duplicateCandidates,
    pendingReview,
    approvedClusters,
    legacyCodes,
    dataQuality: dq,
    rationalisation,
    clusters: state.clusters.length,
    activeMappings: state.mappings.filter((m) => m.status === "active").length,
    pendingMappings: state.mappings.filter((m) => m.status === "pending").length,
    nationalCodes: state.nationalCodes.filter((c) => c.status === "active").length,
    openGovernance: state.governance.filter((g) => g.status !== "resolved").length,
    criticalGovernance: state.governance.filter((g) => g.severity === "critical" && g.status !== "resolved").length,
    unread: state.notifications.filter((n) => !n.read && !n.dismissed).length,
    connectedCpses: new Set(state.materials.map((m) => m.cpseId)).size,
    projection: {
      totalMaterials: b.totalMaterials,
      standardized: b.standardized + delta * 137,
      duplicateCandidates: Math.max(0, b.duplicateCandidates - delta * 214),
      pendingReview: Math.max(0, b.pendingReview - delta * 3),
      mappedToNational: b.mappedToNational + delta * 186,
      legacyCodes: Math.max(0, b.legacyCodes - delta * 186),
      rationalisationValue: b.rationalisationValue + delta * 4,
    },
  };
}

const NummContext = createContext<NummContextValue | null>(null);

export function NummProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const cpseName = useCallback(
    (id: string) => CPSES.find((c) => c.id === id)?.shortName ?? id,
    [],
  );
  const can = useCallback(
    (capability: Capability) => (CAPABILITIES[state.user.role] ?? []).includes(capability),
    [state.user.role],
  );
  const metrics = useMemo(() => computeMetrics(state), [state]);
  const toggleSidebar = useCallback(() => setSidebarCollapsed((v) => !v), []);

  const value = useMemo<NummContextValue>(
    () => ({
      state,
      dispatch,
      actor: state.user,
      cpseName,
      metrics,
      can,
      sidebarCollapsed,
      toggleSidebar,
    }),
    [state, cpseName, metrics, can, sidebarCollapsed, toggleSidebar],
  );

  return <NummContext.Provider value={value}>{children}</NummContext.Provider>;
}

export function useNumm() {
  const ctx = useContext(NummContext);
  if (!ctx) throw new Error("useNumm must be used inside NummProvider");
  return ctx;
}

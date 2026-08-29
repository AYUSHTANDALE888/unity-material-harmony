export type MaterialStatus =
  | "unstandardized"
  | "standardized"
  | "duplicate-candidate"
  | "under-review"
  | "mapped";

export type ApprovalStatus = "not-submitted" | "pending" | "approved" | "rejected";

export type MatchType =
  | "exact-match"
  | "near-duplicate"
  | "functional-equivalent"
  | "potential-conflict"
  | "no-match";

export type Severity = "critical" | "high" | "medium" | "low";

export interface Cpse {
  id: string;
  name: string;
  shortName: string;
  sector: string;
  erp: string;
  region: string;
}

export interface Material {
  id: string;
  cpseId: string;
  cpseCode: string;
  description: string;
  standardDescription: string | null;
  category: string;
  subCategory: string;
  classificationPath: string[];
  specification: string;
  uom: string;
  status: MaterialStatus;
  approvalStatus: ApprovalStatus;
  confidence: number | null;
  nationalCode: string | null;
  clusterId: string | null;
  attributes: Record<string, string>;
  manufacturer: string;
  unitRate: number;
  stockQty: number;
  dataQuality: number;
  lastUpdated: string;
  source: string;
  lifecycle: "Active" | "Under Revision" | "Legacy" | "Blocked";
  version: string;
}

export interface DuplicateCluster {
  id: string;
  category: string;
  memberIds: string[];
  similarity: number;
  descriptionSimilarity: number;
  specificationSimilarity: number;
  attributeOverlap: number;
  uomCompatible: boolean;
  classificationSimilarity: number;
  matchType: MatchType;
  status: "detected" | "recommended" | "under-review" | "approved" | "rejected" | "kept-separate" | "dismissed";
  recommendation: {
    nationalCode: string;
    standardDescription: string;
    category: string;
    uom: string;
    confidence: number;
    rationale: string[];
  };
  detectedOn: string;
  reviewer: string | null;
  comments: ClusterComment[];
  slaDays: number;
}

export interface ClusterComment {
  id: string;
  author: string;
  role: string;
  timestamp: string;
  body: string;
  kind: "comment" | "clarification" | "decision";
}

export interface NationalCode {
  id: string;
  code: string;
  standardDescription: string;
  category: string;
  uom: string;
  status: "active" | "draft" | "pending-approval";
  mappedCpses: string[];
  mappedLegacyCodes: number;
  approvedOn: string | null;
  approvedBy: string | null;
  clusterId: string | null;
}

export interface Mapping {
  id: string;
  nationalCode: string;
  cpseId: string;
  cpseCode: string;
  materialId: string | null;
  status: "active" | "pending" | "retired";
  mappedOn: string;
  approvedBy: string | null;
  note?: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  entity: string;
  previousValue: string;
  newValue: string;
  reason: string;
  status: "success" | "info" | "warning";
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  dismissed: boolean;
  kind: "review" | "migration" | "duplicate" | "mapping" | "import" | "integration";
  link?: string;
}

export interface Integration {
  id: string;
  system: string;
  cpseId: string;
  status: "connected" | "syncing" | "warning" | "offline";
  lastSync: string;
  recordsImported: number;
  recordsExported: number;
  errors: number;
  endpoint: string;
  logs: { timestamp: string; level: "info" | "warn" | "error"; message: string }[];
}

export interface GovernanceIssue {
  id: string;
  type: string;
  severity: Severity;
  entity: string;
  cpseId: string;
  detail: string;
  raisedOn: string;
  status: "open" | "acknowledged" | "resolved";
  owner: string;
}

export interface ClassificationNode {
  id: string;
  name: string;
  level: number;
  children: ClassificationNode[];
}

export interface TrendPoint {
  month: string;
  imported: number;
  matched: number;
  standardized: number;
  approved: number;
}

export interface MigrationBatch {
  id: string;
  cpseId: string;
  dataset: string;
  legacyRecords: number;
  mapped: number;
  unmapped: number;
  conflicts: number;
  status: "draft" | "validating" | "ready" | "executing" | "completed" | "failed";
  startedOn: string;
  completedOn: string | null;
  progress: number;
}

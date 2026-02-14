/* Type definitions for AutoHelper API responses */

export interface HealthResponse {
  status: "ok" | "error";
  uptime?: string;
}

export interface StatusResponse {
  database?: {
    accessible: boolean;
    migration_count: number;
  };
}

export type FieldType =
  | "bool"
  | "int"
  | "string"
  | "select"
  | "string_list"
  | "tag_list"
  | "text";

export interface SchemaField {
  key: string;
  label: string;
  type: FieldType;
  default?: unknown;
  min?: number;
  max?: number;
  options?: string[];
  placeholder?: string;
  row_group?: string;
  depends_on?: string;
}

export interface SchemaSection {
  label: string;
  admin_only?: boolean;
  fields: SchemaField[];
}

export interface ConfigSchema {
  sections: SchemaSection[];
}

export type ConfigValues = Record<string, unknown>;

export interface ContactStatus {
  enabled: boolean;
  last_sync: string | null;
  next_sync: string | null;
  last_status: string | null;
}

export interface ContactHistoryEntry {
  started_at: string;
  status: string;
  created?: number;
  updated?: number;
  deleted?: number;
}

export interface ContactHistory {
  entries: ContactHistoryEntry[];
}

export interface SyncResult {
  message: string;
}

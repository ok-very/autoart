import { useState, useEffect, useCallback } from "react";
import { api } from "../api";
import type { ConfigSchema, ConfigValues } from "../types";

interface UseConfigResult {
  schema: ConfigSchema | null;
  config: ConfigValues | null;
  loading: boolean;
  error: Error | null;
  saving: boolean;
  saveSection: (values: ConfigValues) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useConfig(): UseConfigResult {
  const [schema, setSchema] = useState<ConfigSchema | null>(null);
  const [config, setConfig] = useState<ConfigValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const [schemaData, configData] = await Promise.all([
        api.get<ConfigSchema>("/config/schema"),
        api.get<ConfigValues>("/config"),
      ]);
      setSchema(schemaData);
      setConfig(configData);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  const saveSection = useCallback(async (values: ConfigValues) => {
    setSaving(true);
    try {
      const updated = await api.put<ConfigValues>("/config", values);
      setConfig(updated);
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return {
    schema,
    config,
    loading,
    error,
    saving,
    saveSection,
    refresh: fetchConfig,
  };
}

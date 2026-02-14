import { useState, useEffect, useCallback } from "react";
import { api } from "../api";
import type { HealthResponse, StatusResponse } from "../types";

interface CombinedStatus {
  service: { status: "ok" | "error"; message: string };
  database: { status: "ok" | "error"; message: string };
  migrations: { status: "ok"; message: string };
  uptime: { status: "ok"; message: string };
}

interface UseHealthResult {
  data: CombinedStatus | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useHealth(pollInterval = 30000): UseHealthResult {
  const [data, setData] = useState<CombinedStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const [health, status] = await Promise.all([
        api.get<HealthResponse>("/health"),
        api.get<StatusResponse>("/status"),
      ]);

      const combined: CombinedStatus = {
        service: {
          status: health.status === "ok" ? "ok" : "error",
          message: health.status === "ok" ? "Running" : "Error",
        },
        database: {
          status: status.database?.accessible ? "ok" : "error",
          message: status.database?.accessible ? "Connected" : "Unreachable",
        },
        migrations: {
          status: "ok",
          message: `${status.database?.migration_count ?? 0} applied`,
        },
        uptime: {
          status: "ok",
          message: health.uptime || "—",
        },
      };

      setData(combined);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setData({
        service: { status: "error", message: "Unreachable" },
        database: { status: "error", message: "Unreachable" },
        migrations: { status: "ok", message: "—" },
        uptime: { status: "ok", message: "—" },
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, pollInterval);
    return () => clearInterval(interval);
  }, [fetchHealth, pollInterval]);

  return { data, loading, error, refresh: fetchHealth };
}

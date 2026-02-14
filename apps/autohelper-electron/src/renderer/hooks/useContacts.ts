import { useState, useEffect, useCallback } from "react";
import { api } from "../api";
import type { ContactStatus, ContactHistory, SyncResult } from "../types";

interface UseContactsResult {
  status: ContactStatus | null;
  history: ContactHistory | null;
  loading: boolean;
  error: Error | null;
  syncing: boolean;
  triggerSync: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useContacts(pollInterval = 30000): UseContactsResult {
  const [status, setStatus] = useState<ContactStatus | null>(null);
  const [history, setHistory] = useState<ContactHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [syncing, setSyncing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statusData, historyData] = await Promise.all([
        api.get<ContactStatus>("/contacts/status"),
        api.get<ContactHistory>("/contacts/history"),
      ]);
      setStatus(statusData);
      setHistory(historyData);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setStatus(null);
      setHistory(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const triggerSync = useCallback(async () => {
    setSyncing(true);
    try {
      await api.post<SyncResult>("/contacts/sync", {});
      await fetchData();
    } finally {
      setSyncing(false);
    }
  }, [fetchData]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, pollInterval);
    return () => clearInterval(interval);
  }, [fetchData, pollInterval]);

  return {
    status,
    history,
    loading,
    error,
    syncing,
    triggerSync,
    refresh: fetchData,
  };
}

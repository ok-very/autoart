import { useState, useCallback, useMemo } from "react";
import type { ConfigValues } from "../types";

interface PairResponse {
  key: string;
}

interface UsePairingResult {
  paired: boolean;
  pairing: boolean;
  unpairing: boolean;
  pair: (code: string) => Promise<void>;
  unpair: () => Promise<void>;
}

export function usePairing(config: ConfigValues | null, onConfigUpdate: (values: ConfigValues) => Promise<void>): UsePairingResult {
  const [pairing, setPairing] = useState(false);
  const [unpairing, setUnpairing] = useState(false);

  const paired = useMemo(() => {
    return !!config?.autoart_link_key;
  }, [config]);

  const pair = useCallback(
    async (code: string) => {
      if (!config) return;

      setPairing(true);
      try {
        const apiUrl = (config.autoart_api_url as string) || "http://localhost:3001";
        const res = await fetch(apiUrl + "/api/pair/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: code.trim() }),
        });

        if (!res.ok) throw new Error("Invalid code or expired");

        const data: PairResponse = await res.json();
        await onConfigUpdate({ autoart_link_key: data.key });
      } finally {
        setPairing(false);
      }
    },
    [config, onConfigUpdate],
  );

  const unpair = useCallback(async () => {
    if (!config) return;

    setUnpairing(true);
    try {
      const apiUrl = (config.autoart_api_url as string) || "http://localhost:3001";
      const key = config.autoart_link_key as string;

      if (key) {
        // Best-effort notification to backend
        fetch(apiUrl + "/api/autohelper/unpair", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "x-autohelper-key": key,
          },
        }).catch(() => {});
      }

      await onConfigUpdate({ autoart_link_key: "" });
    } finally {
      setUnpairing(false);
    }
  }, [config, onConfigUpdate]);

  return { paired, pairing, unpairing, pair, unpair };
}

import { useState } from "react";
import { usePairing } from "../hooks/usePairing";
import type { ConfigValues } from "../types";

interface PairingProps {
  config: ConfigValues | null;
  onConfigUpdate: (values: ConfigValues) => Promise<void>;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

export function Pairing({ config, onConfigUpdate, onError, onSuccess }: PairingProps) {
  const { paired, pairing, unpairing, pair, unpair } = usePairing(config, onConfigUpdate);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [code, setCode] = useState("");

  const hasFrontend = !!(config?.autoart_frontend_url || config?.autoart_api_url);

  const handlePair = async () => {
    if (code.length !== 6) {
      onError("Code must be 6 characters");
      return;
    }

    try {
      await pair(code);
      onSuccess("Paired successfully");
      setShowCodeInput(false);
      setCode("");
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleUnpair = async () => {
    if (!confirm("Unpair from AutoArt backend?")) return;

    try {
      await unpair();
      onSuccess("Unpaired");
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section>
      <h2>Pairing</h2>
      <div className="section-body">
        <div className="status-row">
          <span className="label">
            <span className={`status-dot ${paired ? "ok" : "warn"}`} />
            Status
          </span>
          <span className="value">{paired ? "Paired" : "Not paired"}</span>
        </div>

        {showCodeInput && !paired && (
          <div className="field" style={{ marginTop: "12px" }}>
            <label htmlFor="pairing-code">Pairing Code</label>
            <input
              type="text"
              id="pairing-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="6-character code"
              style={{ width: "200px" }}
            />
          </div>
        )}

        <div className="button-row">
          {!paired && hasFrontend && !showCodeInput && (
            <button onClick={() => setShowCodeInput(true)}>Pair with AutoArt</button>
          )}

          {showCodeInput && !paired && (
            <>
              <button onClick={handlePair} disabled={pairing || code.length !== 6} className="primary">
                {pairing ? "Pairing..." : "Submit"}
              </button>
              <button onClick={() => setShowCodeInput(false)}>Cancel</button>
            </>
          )}

          {paired && (
            <button onClick={handleUnpair} disabled={unpairing} className="danger">
              {unpairing ? "Unpairing..." : "Unpair"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

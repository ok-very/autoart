import { StatusRow } from "./StatusRow";
import { useContacts } from "../hooks/useContacts";

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString();
}

interface ContactSyncProps {
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

export function ContactSync({ onError, onSuccess }: ContactSyncProps) {
  const { status, history, loading, syncing, triggerSync } = useContacts();

  const handleSync = async () => {
    try {
      await triggerSync();
      onSuccess("Contact sync triggered");
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };

  if (loading) {
    return (
      <section>
        <h2>Contact Sync Status</h2>
        <div className="section-body">
          <StatusRow label="Loading..." value="" status="ok" />
        </div>
      </section>
    );
  }

  if (!status) {
    return (
      <section>
        <h2>Contact Sync Status</h2>
        <div className="section-body">
          <div className="status-row">
            <span className="label">Status</span>
            <span className="value empty">Module not available</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section>
        <h2>Contact Sync Status</h2>
        <div className="section-body">
          <StatusRow
            label="Enabled"
            value={status.enabled ? "Yes" : "No"}
            status={status.enabled ? "ok" : "warn"}
          />
          <StatusRow label="Last Sync" value={formatTime(status.last_sync)} status="ok" />
          <StatusRow label="Next Sync" value={formatTime(status.next_sync)} status="ok" />
          <StatusRow
            label="Last Result"
            value={status.last_status || "—"}
            status={status.last_status === "failed" ? "error" : "ok"}
          />
          <div className="button-row">
            <button onClick={handleSync} disabled={syncing}>
              {syncing ? "Syncing..." : "Sync Now"}
            </button>
          </div>
        </div>
      </section>

      <section>
        <h2>Sync History</h2>
        <div className="section-body">
          <table className="log-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Status</th>
                <th>Created</th>
                <th>Updated</th>
                <th>Deleted</th>
              </tr>
            </thead>
            <tbody>
              {!history || history.entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty">
                    No sync history
                  </td>
                </tr>
              ) : (
                history.entries.map((entry, idx) => (
                  <tr key={idx}>
                    <td>{formatTime(entry.started_at)}</td>
                    <td>{entry.status}</td>
                    <td>{entry.created ?? 0}</td>
                    <td>{entry.updated ?? 0}</td>
                    <td>{entry.deleted ?? 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

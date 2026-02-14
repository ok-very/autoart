import { StatusRow } from "./StatusRow";
import { useHealth } from "../hooks/useHealth";

export function ServiceStatus() {
  const { data, loading } = useHealth();

  if (loading) {
    return (
      <section>
        <h2>Service Status</h2>
        <div className="section-body">
          <StatusRow label="Loading..." value="" status="ok" />
        </div>
      </section>
    );
  }

  if (!data) return null;

  return (
    <section>
      <h2>Service Status</h2>
      <div className="section-body">
        <StatusRow label="Service" value={data.service.message} status={data.service.status} />
        <StatusRow label="Database" value={data.database.message} status={data.database.status} />
        <StatusRow label="Migrations" value={data.migrations.message} status={data.migrations.status} />
        <StatusRow label="Uptime" value={data.uptime.message} status={data.uptime.status} />
      </div>
    </section>
  );
}

interface StatusRowProps {
  label: string;
  value: string;
  status: "ok" | "warn" | "error";
}

export function StatusRow({ label, value, status }: StatusRowProps) {
  return (
    <div className="status-row">
      <span className="label">
        <span className={`status-dot ${status}`} />
        {label}
      </span>
      <span className="value">{value}</span>
    </div>
  );
}

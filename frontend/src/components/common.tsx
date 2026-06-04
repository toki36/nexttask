export function StatusMessage({ status, error }: { status: string; error: string }) {
  if (error) return <p className="status-line error">{error}</p>;
  return <p className="status-line">{status}</p>;
}

export function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <p className="stat-value">{value}</p>
      <p className="stat-label">{label}</p>
    </div>
  );
}

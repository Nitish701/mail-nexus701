export function StatCard({
  label,
  value,
  tone = 'default',
  hint
}: {
  label: string;
  value: string | number;
  tone?: 'default' | 'critical' | 'high' | 'ok' | 'review' | 'medium';
  hint?: string;
}) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <span className="stat-card-label">{label}</span>
      <div className="stat-card-value">{value}</div>
      {hint ? <span className="stat-card-detail">{hint}</span> : null}
    </div>
  );
}

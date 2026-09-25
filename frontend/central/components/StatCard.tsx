export function StatCard({
  label,
  value,
  tone = 'default',
  hint
}: {
  label: string;
  value: string | number;
  tone?: 'default' | 'critical' | 'high' | 'ok';
  hint?: string;
}) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value">{value}</div>
      {hint ? <div className="stat-card-hint">{hint}</div> : null}
    </div>
  );
}
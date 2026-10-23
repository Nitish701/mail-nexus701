'use client';

export function ViewToggle({
  value,
  onChange
}: {
  value: 'list' | 'graph';
  onChange: (v: 'list' | 'graph') => void;
}) {
  return (
    <div className="view-toggle" role="tablist" aria-label="Campaign view mode">
      <button
        type="button"
        role="tab"
        aria-selected={value === 'list'}
        className={value === 'list' ? 'is-active' : ''}
        onClick={() => onChange('list')}
      >
        List view
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'graph'}
        className={value === 'graph' ? 'is-active' : ''}
        onClick={() => onChange('graph')}
      >
        Relationship graph
      </button>
    </div>
  );
}

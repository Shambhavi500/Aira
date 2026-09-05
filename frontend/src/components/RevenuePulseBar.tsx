import React from 'react';

interface RevenuePulseBarProps {
  atRisk: number;
  recovered: number;
  currency?: string;
}

export const RevenuePulseBar: React.FC<RevenuePulseBarProps> = ({
  atRisk,
  recovered,
  currency = '₹',
}) => {
  const total = Math.max(atRisk, recovered);
  const recoveredPct = total > 0 ? Math.min(100, Math.round((recovered / total) * 100)) : 0;
  const inFlightPct = total > 0 ? Math.max(0, Math.round(((total - recovered) * 0.75 / total) * 100)) : 0;
  const remainingPct = Math.max(0, 100 - recoveredPct - inFlightPct);

  return (
    <div style={{ background: 'var(--bg-surface)', padding: 'var(--space-4) var(--space-5)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-card)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
        <div>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>
            Revenue Recovery Flow
          </span>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
            {currency}{atRisk.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, marginLeft: '8px' }}>Total Detected At Risk</span>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--color-success)' }}>
            Recovered To Date
          </span>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-success)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
            {currency}{recovered.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, marginLeft: '8px' }}>
              ({recoveredPct}% yield)
            </span>
          </div>
        </div>
      </div>

      {/* Tri-color Stacked Bar */}
      <div className="pipeline-flow-bar" style={{ height: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
        <div
          className="pipeline-flow-segment"
          style={{ width: `${recoveredPct}%`, background: 'var(--color-success)' }}
          title={`Recovered: ${currency}${recovered.toLocaleString('en-IN')}`}
        />
        <div
          className="pipeline-flow-segment"
          style={{ width: `${inFlightPct}%`, background: 'var(--color-primary)' }}
          title={`In-Flight Autonomous Recovery: ${inFlightPct}%`}
        />
        <div
          className="pipeline-flow-segment"
          style={{ width: `${remainingPct}%`, background: 'var(--color-warning)' }}
          title={`Under Active Evaluation / Escalation: ${remainingPct}%`}
        />
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-2)', fontSize: '11px', color: 'var(--text-secondary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#10b981' }} />
          <span>Recovered Volume ({recoveredPct}%)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#3b82f6' }} />
          <span>Autonomous In-Flight ({inFlightPct}%)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#ef4444' }} />
          <span>Pending / Escalated ({remainingPct}%)</span>
        </div>
      </div>
    </div>
  );
};

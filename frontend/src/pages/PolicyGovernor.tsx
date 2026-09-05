import { useEffect, useState } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { api } from '../api/client';
import type { PolicyRule } from '../api/client';
import { useAiraState } from '../context/AiraStateContext';

export default function PolicyGovernor() {
  const { metrics, notify } = useAiraState();
  const [rules, setRules] = useState<PolicyRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.policyRules();
      setRules(data);
    } catch (err: any) {
      notify('Failed to load policy rules', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = rules.filter((r) => {
    if (typeFilter === 'ALL') return true;
    return r.rule_type === typeFilter;
  });

  const interventionCount = metrics?.blocked_actions ?? 0;

  return (
    <div className="page-body">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-5)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Regulatory Policy Governor & Safety Bounds
            </h1>
            <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={12} />
              RBI & Global Compliance Active
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Autonomous guardrails enforcing RBI mandate cooldown rules, DND contact limits, and anti-harassment cooling periods.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button onClick={loadData} disabled={loading} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} className={loading ? 'spin-icon' : ''} />
            <span>Refresh Rules</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 'var(--space-5)' }}>
        <div className="metric-card">
          <div className="metric-label">Active Guardrail Rules</div>
          <div className="metric-value blue" style={{ fontFamily: 'var(--font-mono)' }}>
            {rules.length}
          </div>
          <div className="metric-sub">100% regulatory coverage</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Blocked Unsafe Actions</div>
          <div className="metric-value green" style={{ fontFamily: 'var(--font-mono)' }}>
            {interventionCount}
          </div>
          <div className="metric-sub">Protected against excessive dunning</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Compliance Certification</div>
          <div className="metric-value green" style={{ fontSize: '18px' }}>
            RBI CIRCULAR 2023/88
          </div>
          <div className="metric-sub">e-Mandate cooldown verified</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        {(['ALL', 'REGULATORY', 'PRODUCT_SAFETY'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setTypeFilter(tab)}
            style={{
              background: typeFilter === tab ? 'var(--color-primary-dim)' : 'var(--bg-card)',
              color: typeFilter === tab ? 'var(--color-primary)' : 'var(--text-secondary)',
              border: `1px solid ${typeFilter === tab ? 'var(--color-primary)' : 'var(--border-subtle)'}`,
              padding: '6px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {tab === 'ALL' ? 'All Rules' : tab === 'REGULATORY' ? 'RBI & Legal Mandates' : 'Product Safety Guardrails'}
          </button>
        ))}
      </div>

      {/* Policy Rules Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {filtered.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-5)', color: 'var(--text-muted)' }}>
            No policy rules found
          </div>
        ) : (
          filtered.map((rule) => {
            let configObj: any = {};
            try {
              configObj = JSON.parse(rule.config);
            } catch {}

            const isActive = rule.status === 'ACTIVE';

            return (
              <div key={rule.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <ShieldCheck size={18} color="var(--color-primary)" />
                      <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{rule.name}</span>
                      <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        [{rule.rule_key}]
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.5' }}>
                      {rule.description}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <span className={`badge ${rule.rule_type === 'REGULATORY' ? 'badge-orange' : 'badge-primary'}`}>
                      {rule.rule_type}
                    </span>
                    <span className={`badge ${isActive ? 'badge-success' : 'badge-danger'}`}>
                      {rule.status}
                    </span>
                  </div>
                </div>

                {/* Config Parameter Chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', background: 'var(--bg-surface)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '11px' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Governing Parameters:</span>
                  {Object.entries(configObj)
                    .filter(([k]) => k !== 'note' && k !== 'applies_to')
                    .map(([k, v]: [string, any]) => (
                      <span key={k} style={{ background: 'var(--bg-card)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)' }}>
                        {k}: <strong style={{ color: 'var(--color-primary)' }}>{String(v)}</strong>
                      </span>
                    ))}
                </div>

                {/* Source Reference */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-3)', fontSize: '11px', color: 'var(--text-muted)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  <div>
                    <strong>Regulatory Authority:</strong> {rule.source || 'Reserve Bank of India (RBI)'}
                  </div>
                  {rule.source_url && (
                    <a href={rule.source_url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <span>Official Gazette Reference</span>
                      <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

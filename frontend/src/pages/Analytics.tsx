import { useState, useEffect } from 'react';
import {
  RefreshCw,
  Sparkles,
  FileSpreadsheet,
  Download,
} from 'lucide-react';
import { api } from '../api/client';
import type { AnalyticsIntelligenceResponse } from '../api/client';
import { useAiraState } from '../context/AiraStateContext';
import { RevenuePulseBar } from '../components/RevenuePulseBar';
import { formatINR } from '../utils/formatters';

export default function Analytics() {
  const { notify } = useAiraState();
  const [data, setData] = useState<AnalyticsIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.analyticsIntelligence('30d');
      setData(res);
    } catch (err: any) {
      notify('Failed to load analytics', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleExport = (format: 'csv' | 'json') => {
    const url = api.exportReportUrl(format);
    window.open(url, '_blank');
    notify('Report Exported', `Downloading ${format.toUpperCase()} financial recovery ledger.`, 'success');
  };

  const flow = data?.revenue_flow;
  const channels = data?.channel_performance || [];
  const cohorts = data?.cohort_curves || [];
  const stages = data?.pipeline_stages || [];

  return (
    <div className="page-body">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-5)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Financial Intelligence & Revenue Operations Center
            </h1>
            <span className="badge badge-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={12} />
              Continuous Telemetry
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Comprehensive recovery curves, channel unit economics, corridor latency breakdowns, and verifiable audit exports.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            onClick={() => handleExport('csv')}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Download CSV report of all recovery cases"
          >
            <FileSpreadsheet size={14} />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => handleExport('json')}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Download JSON structured export"
          >
            <Download size={14} />
            <span>Export JSON</span>
          </button>
          <button onClick={loadData} disabled={loading} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} className={loading ? 'spin-icon' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 'var(--space-5)' }}>
        <div className="metric-card">
          <div className="metric-label">Total Revenue at Risk</div>
          <div className="metric-value red" style={{ fontFamily: 'var(--font-mono)' }}>
            {formatINR(flow?.at_risk || 0)}
          </div>
          <div className="metric-sub">Detected leakage across all corridors</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Autonomous Recovered</div>
          <div className="metric-value green" style={{ fontFamily: 'var(--font-mono)' }}>
            {formatINR(flow?.recovered || 0)}
          </div>
          <div className="metric-sub">{flow?.recovery_rate_pct || 0}% overall recovery rate</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Recoverable Pipeline</div>
          <div className="metric-value blue" style={{ fontFamily: 'var(--font-mono)' }}>
            {formatINR(flow?.recoverable || 0)}
          </div>
          <div className="metric-sub">Active in autonomous sequences</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Total Pipeline Cases</div>
          <div className="metric-value purple" style={{ fontFamily: 'var(--font-mono)' }}>
            {data?.total_cases || 0}
          </div>
          <div className="metric-sub">Across 7 recovery scenarios</div>
        </div>
      </div>

      {/* Flow Stacked Bar */}
      {flow && (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <RevenuePulseBar atRisk={flow.at_risk} recovered={flow.recovered} />
        </div>
      )}

      {/* Channels ROI Matrix & Corridor Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
        {/* Channel Performance Table */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <div>
              <div className="card-title" style={{ margin: 0 }}>Recovery Channel ROI & Unit Economics</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Conversion yield and resolution velocity by engagement channel
              </div>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Recovered Amount</th>
                  <th>Conversion Rate</th>
                  <th>Avg Resolution</th>
                  <th>ROI Multiplier</th>
                </tr>
              </thead>
              <tbody>
                {channels.map((ch) => (
                  <tr key={ch.channel}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                      {ch.channel.replace(/_/g, ' ')}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-success)' }}>
                      {formatINR(ch.volume_recovered)}
                    </td>
                    <td>
                      <span className="badge badge-primary">{ch.success_rate}%</span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{ch.avg_recovery_time_hrs}h</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-purple)', fontWeight: 600 }}>
                      {ch.roi_multiplier}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pipeline Stages Breakdown */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <div>
              <div className="card-title" style={{ margin: 0 }}>Pipeline Stage Distribution</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Active recovery cases in flight
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {stages.map((s) => (
              <div
                key={s.stage}
                style={{
                  background: 'var(--bg-surface)',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{s.stage}</span>
                  <span className="badge badge-primary">{s.count} cases</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <span>{s.description}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-success)' }}>{formatINR(s.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cohort Aging Curves Trajectory */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <div>
            <div className="card-title" style={{ margin: 0 }}>Cohort Recovery Trajectory Curve</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Cumulative recovery rate as days elapsed from payment failure event
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-3)' }}>
          {cohorts.map((cohort) => (
            <div
              key={cohort.time_bucket}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3) var(--space-4)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>{cohort.time_bucket}</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', margin: '4px 0' }}>
                {cohort.recovered_pct}%
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: 600 }}>
                {formatINR(cohort.recovered_amount)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

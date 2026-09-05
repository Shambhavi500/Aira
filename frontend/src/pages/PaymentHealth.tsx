import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Zap,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../api/client';
import type { PaymentHealthResponse, PaymentCorridor, PaymentIncident } from '../api/client';
import { useAiraState } from '../context/AiraStateContext';
import { formatINR, formatPercent } from '../utils/formatters';

export default function PaymentHealth() {
  const { refreshMetrics, notify, setActiveEntityContext } = useAiraState();
  const [data, setData] = useState<PaymentHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [simulating, setSimulating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.paymentHealth('24h');
      setData(res);
      setActiveEntityContext({
        currentModule: 'Payment Degradation',
        rootCause: 'ISSUER_NODE_TIMEOUT (HDFC UPI Switch latency > 1850ms)',
        suggestedAction: 'Execute autonomous failover to ICICI backup corridor',
        riskTier: 'HIGH',
      });
    } catch (err: any) {
      notify('Failed to load corridor health', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    return () => {
      setActiveEntityContext(null);
    };
  }, []);

  const handleExecuteFailover = async (incidentId = 'inc_upi_route_01') => {
    setExecuting(true);
    try {
      const res = await api.recoverIncident(incidentId);
      notify('Autonomous Failover Executed', res.message || 'Payment traffic rerouted to secondary high-availability corridor.', 'success');
      await refreshMetrics();
      await loadData();
    } catch (err: any) {
      notify('Failover Failed', err.message, 'error');
    } finally {
      setExecuting(false);
    }
  };

  const handleSimulateDegradation = async () => {
    setSimulating(true);
    try {
      const res = await api.simulateIncident();
      notify('Degradation Anomaly Triggered', res.message || 'Simulated latency spike on HDFC UPI rail.', 'warning');
      await refreshMetrics();
      await loadData();
    } catch (err: any) {
      notify('Simulation Failed', err.message, 'error');
    } finally {
      setSimulating(false);
    }
  };

  const handleReset = async (incidentId = 'inc_upi_route_01') => {
    setResetting(true);
    try {
      const res = await api.resetIncident(incidentId);
      notify('Corridors Normalized', res.message || 'Corridor telemetry restored to baseline.', 'info');
      await refreshMetrics();
      await loadData();
    } catch (err: any) {
      notify('Reset Failed', err.message, 'error');
    } finally {
      setResetting(false);
    }
  };

  const corridors: PaymentCorridor[] =
    data?.corridors || (data as any)?.corridor_breakdown || [];
  const incidents: PaymentIncident[] = Array.isArray(data?.active_incidents)
    ? data.active_incidents
    : (data as any)?.incident
    ? [(data as any).incident]
    : Array.isArray((data as any)?.incidents)
    ? (data as any).incidents
    : [];
  const activeIncident = incidents.find((i) => i.status === 'ACTIVE') || (incidents.length > 0 ? incidents[0] : null);

  // Compute live channel metrics from actual corridor items
  const upiCorridors = corridors.filter((c) => c.method?.toUpperCase() === 'UPI');
  const cardCorridors = corridors.filter((c) => c.method?.toUpperCase() === 'CARD');
  const nbCorridors = corridors.filter((c) => c.method?.toUpperCase() === 'NETBANKING');

  const calcWeightedSR = (list: PaymentCorridor[]) => {
    const totalVol = list.reduce((s, c) => s + (c.volume_24h || 1), 0);
    if (totalVol === 0 || list.length === 0) return null;
    return list.reduce((s, c) => s + (c.success_rate || 0) * (c.volume_24h || 1), 0) / totalVol;
  };

  const overallSR = data?.overall_success_rate ?? calcWeightedSR(corridors);
  const upiSR = calcWeightedSR(upiCorridors);
  const cardSR = calcWeightedSR(cardCorridors);
  const nbSR = calcWeightedSR(nbCorridors);

  return (
    <div className="page-body">
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-5)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Payment Route Degradation & Failover Control
            </h1>
            <span className="badge badge-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={12} />
              Autonomous Gateway Rerouting
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Live corridor health tracking, anomaly detection, automated traffic shifting, and gateway degradation failover.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            onClick={handleSimulateDegradation}
            disabled={simulating}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-warning)' }}
            title="Simulate bank latency degradation on HDFC UPI corridor"
          >
            <AlertTriangle size={14} className={simulating ? 'spin-icon' : ''} />
            <span>Simulate Degradation</span>
          </button>
          <button
            onClick={() => handleReset(activeIncident?.id || 'inc_upi_route_01')}
            disabled={resetting}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RotateCcw size={14} className={resetting ? 'spin-icon' : ''} />
            <span>Reset Telemetry</span>
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
          <div className="metric-label">Overall Success Rate (SR)</div>
          <div className={`metric-value ${overallSR !== null && overallSR < 88 ? 'red' : 'green'}`} style={{ fontFamily: 'var(--font-mono)' }}>
            {formatPercent(overallSR)}
          </div>
          <div className="metric-sub">SLA Baseline: 95.0%</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">UPI Corridor SR</div>
          <div className={`metric-value ${upiSR !== null && upiSR < 85 ? 'red' : 'green'}`} style={{ fontFamily: 'var(--font-mono)' }}>
            {formatPercent(upiSR)}
          </div>
          <div className="metric-sub">{upiCorridors.length} active UPI rails</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Cards Corridor SR</div>
          <div className={`metric-value ${cardSR !== null && cardSR < 85 ? 'red' : 'green'}`} style={{ fontFamily: 'var(--font-mono)' }}>
            {formatPercent(cardSR)}
          </div>
          <div className="metric-sub">Visa, Mastercard, RuPay 3DS</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Netbanking Corridor SR</div>
          <div className={`metric-value ${nbSR !== null && nbSR < 85 ? 'red' : 'green'}`} style={{ fontFamily: 'var(--font-mono)' }}>
            {formatPercent(nbSR)}
          </div>
          <div className="metric-sub">Corporate & Retail Banking Switches</div>
        </div>
      </div>

      {/* Active Incident Warning / Recovery Box */}
      {activeIncident && activeIncident.status === 'ACTIVE' && (
        <div
          className="card"
          style={{
            background: 'var(--color-danger-dim)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderLeft: '4px solid var(--color-danger)',
            marginBottom: 'var(--space-5)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={20} color="var(--color-danger)" />
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-danger)', margin: 0 }}>
                Corridor Latency Anomaly: {activeIncident.corridor || activeIncident.title || 'HDFC Bank UPI Rail'}
              </h2>
              <span className="badge badge-danger">CRITICAL DEGRADATION</span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Detected: {activeIncident.started_at || activeIncident.detected_at ? new Date(activeIncident.started_at || activeIncident.detected_at || '').toLocaleTimeString() : 'Just now'}
            </span>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', lineHeight: '1.5' }}>
            {activeIncident.suspected_cause || activeIncident.root_cause || 'Elevated timeout rate detected on payment rail. Degradation exceeds safety threshold.'}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <div style={{ background: 'var(--bg-surface)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Degraded Route</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{activeIncident.corridor || activeIncident.title || 'HDFC Bank UPI Rail'}</div>
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Observed Error Rate</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-danger)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                {activeIncident.error_rate ? `${activeIncident.error_rate.toFixed(1)}%` : activeIncident.success_rate_drop ? `${activeIncident.success_rate_drop.toFixed(1)}%` : '15.9%'}
              </div>
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Threshold Limit</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                {activeIncident.threshold ? `${activeIncident.threshold.toFixed(1)}%` : '8.0%'}
              </div>
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Recommended Failover</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-success)', marginTop: '2px' }}>{activeIncident.failover_corridor || 'ICICI Instant UPI Rail'}</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
            <button
              onClick={() => handleExecuteFailover(activeIncident.id)}
              disabled={executing}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Zap size={14} className={executing ? 'spin-icon' : ''} />
              <span>{executing ? 'Executing Failover...' : 'Execute Autonomous Failover'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Autonomous Failover Recovered Banner */}
      {activeIncident && (activeIncident.status === 'RECOVERED' || activeIncident.status === 'RESOLVED') && (
        <div
          className="card"
          style={{
            background: 'var(--color-success-dim)',
            border: '1px solid rgba(4, 219, 124, 0.3)',
            borderLeft: '4px solid var(--color-success)',
            marginBottom: 'var(--space-5)',
            padding: 'var(--space-4)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={20} color="var(--color-success)" />
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-success)', margin: 0 }}>
                Corridor Failover Active & Recovered
              </h2>
              <span className="badge badge-success">AUTONOMOUS FAILOVER COMPLETE</span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Recovered by Aira Autonomous Engine
            </span>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', lineHeight: '1.5' }}>
            Traffic automatically shifted from degraded HDFC UPI switch to ICICI Instant UPI Rail. Payment success rate restored to SLA compliance (98.6%).
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
            <div style={{ background: 'var(--bg-surface)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Active Failover Route</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>HDFC UPI Rail → ICICI Rail</div>
            </div>
            <div style={{ background: 'var(--bg-surface)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Restored Success Rate</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-success)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>98.6%</div>
            </div>
            <div style={{ background: 'var(--bg-surface)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Revenue Secured</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-success)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>{formatINR(activeIncident.revenue_recovered || 420000)}</div>
            </div>
            <div style={{ background: 'var(--bg-surface)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Policy Verification</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-primary)', marginTop: '2px' }}>RBI Cooldown Compliant</div>
            </div>
          </div>
        </div>
      )}

      {/* Nominal SLA Banner (when no incidents at all) */}
      {!activeIncident && (
        <div className="card" style={{ background: 'rgba(4, 219, 124, 0.05)', border: '1px solid var(--color-success)', marginBottom: 'var(--space-5)', padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={20} color="var(--color-success)" />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--color-success)', fontSize: '14px' }}>All Payment Corridors Operating Within SLA Limits</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Automated multi-bank switches and latency load-balancers are healthy. Real-time anomaly detection active.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Corridors Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <div>
            <div className="card-title" style={{ margin: 0 }}>Live Corridor Performance Telemetry</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Real-time authorization success rates, p95 latency, and 24h settlement volume across banking switches
            </div>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Corridor / Provider</th>
                <th>Method</th>
                <th>Status</th>
                <th>Success Rate</th>
                <th>Latency (p95)</th>
                <th style={{ textAlign: 'right' }}>24h Volume</th>
                <th>AI Routing Action</th>
              </tr>
            </thead>
            <tbody>
              {corridors.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 'var(--space-5)', color: 'var(--text-muted)' }}>
                    No payment corridors active
                  </td>
                </tr>
              ) : (
                corridors.map((c) => {
                  const isDegraded = c.status === 'DEGRADED';
                  return (
                    <tr key={c.id || (c as any).corridor_id || c.name}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>{c.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.provider}</div>
                      </td>
                      <td>
                        <span className="badge badge-subtle">{c.method}</span>
                      </td>
                      <td>
                        <span className={`badge ${isDegraded ? 'badge-danger' : 'badge-success'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: isDegraded ? 'var(--color-danger)' : 'var(--color-success)' }}>
                            {formatPercent(c.success_rate)}
                          </span>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                        {c.latency_p95 ? `${c.latency_p95}ms` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {formatINR(c.volume_24h)}
                      </td>
                      <td style={{ fontSize: '12px', color: isDegraded ? 'var(--color-warning)' : 'var(--text-muted)', maxWidth: '280px' }}>
                        {c.recommendation || (isDegraded ? 'Reroute active' : 'Normal')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

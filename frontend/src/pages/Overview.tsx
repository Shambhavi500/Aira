import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  RefreshCw,
  ShoppingCart,
  PhoneCall,
  GitMerge,
  ChevronRight,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { api } from '../api/client';
import type { ScenarioMetric, RootCauseMetric, AuditEvent } from '../api/client';
import { useAiraState } from '../context/AiraStateContext';
import { RevenuePulseBar } from '../components/RevenuePulseBar';
import { AiDecisionSurface } from '../components/AiDecisionSurface';
import { formatINR, formatPercent, formatRelativeTime } from '../utils/formatters';

export default function Overview() {
  const { metrics, refreshMetrics, notify, setWelcomeOpen } = useAiraState();
  const [byScenario, setByScenario] = useState<ScenarioMetric[]>([]);
  const [byRootCause, setByRootCause] = useState<RootCauseMetric[]>([]);
  const [recentActivity, setRecentActivity] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [decisionExecuted, setDecisionExecuted] = useState(false);
  const navigate = useNavigate();

  const loadData = async () => {
    setLoading(true);
    try {
      const [scenarios, roots, rec] = await Promise.all([
        api.metricsScenario(),
        api.metricsRootCause(),
        api.recentActivity(),
      ]);
      setByScenario(scenarios || []);
      setByRootCause(roots || []);
      setRecentActivity(rec || []);
    } catch (err: any) {
      notify('Failed to load telemetry', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const atRisk = metrics?.total_at_risk ?? (metrics as any)?.revenue_at_risk ?? 0;
  const recovered = metrics?.total_recovered ?? (metrics as any)?.revenue_recovered ?? 0;
  const totalVolume = atRisk + recovered;
  const recoveryRate = metrics?.recovery_rate ?? (totalVolume > 0 ? (recovered / totalVolume) * 100 : 0);

  const getScenarioRoute = (name: string) => {
    switch (name) {
      case 'FAILED_SUBSCRIPTION': return '/subscriptions';
      case 'CHECKOUT_DROPOFF': return '/checkout';
      case 'B2B_RECEIVABLE': return '/receivables';
      case 'MANDATE_RETRY': return '/mandates';
      case 'PAYMENT_DEGRADATION': return '/payment-health';
      case 'VOICE_RECOVERY': return '/voice-recovery';
      default: return '/recovery';
    }
  };

  const getScenarioIcon = (type: string) => {
    switch (type) {
      case 'FAILED_SUBSCRIPTION':
        return <RefreshCw size={15} color="#3b82f6" />;
      case 'CHECKOUT_DROPOFF':
        return <ShoppingCart size={15} color="#10b981" />;
      case 'B2B_RECEIVABLE':
        return <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#f59e0b', fontSize: 13 }}>₹</span>;
      case 'MANDATE_RETRY':
        return <GitMerge size={15} color="#8b5cf6" />;
      case 'PAYMENT_DEGRADATION':
        return <ShieldAlert size={15} color="#ef4444" />;
      case 'VOICE_RECOVERY':
        return <PhoneCall size={15} color="#06b6d4" />;
      default:
        return <Sparkles size={15} color="#8b5cf6" />;
    }
  };

  const handleExecuteDecision = async () => {
    try {
      await api.recoverIncident('inc_8901');
      setDecisionExecuted(true);
      notify('Autonomous Routing Executed', 'Rerouted HDFC UPI mandate failures to ICICI instant corridor.', 'success');
      await refreshMetrics();
      await loadData();
    } catch (err: any) {
      notify('Execution Failed', err.message, 'error');
    }
  };

  return (
    <div className="page-body">
      {/* Top Banner / Pulse */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-5)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
              AI Revenue Operations Command Center
            </h1>
            <span className="badge badge-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={12} />
              Autonomous Active
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Continuous detection of payment leakage, root-cause diagnosis, and regulatory-safe autonomous recovery.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            onClick={() => setWelcomeOpen(true)}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="AIRA — Recover More. Do More."
          >
            <Info size={14} />
            <span>About AIRA</span>
          </button>
          <button
            onClick={() => {
              refreshMetrics();
              loadData();
            }}
            disabled={loading}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={loading ? 'spin-icon' : ''} />
            <span>Sync Telemetry</span>
          </button>
        </div>
      </div>

      {/* Hero Revenue Pulse Bar */}
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <RevenuePulseBar atRisk={atRisk} recovered={recovered} />
      </div>

      {/* KPI Cards Grid */}
      <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 'var(--space-5)' }}>
        <div className="metric-card">
          <div className="metric-label">Revenue at Risk</div>
          <div className="metric-value red" style={{ fontFamily: 'var(--font-mono)' }}>
            {formatINR(atRisk)}
          </div>
          <div className="metric-sub">{metrics?.active_cases ?? 0} active recovery cases</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Autonomous Recovered</div>
          <div className="metric-value green" style={{ fontFamily: 'var(--font-mono)' }}>
            {formatINR(recovered)}
          </div>
          <div className="metric-sub">{metrics?.recovered_cases ?? 0} cases fully resolved</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Recovery Rate</div>
          <div className="metric-value purple" style={{ fontFamily: 'var(--font-mono)' }}>
            {formatPercent(recoveryRate)}
          </div>
          <div className="metric-sub">Across all payment channels</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Autonomous Interventions</div>
          <div className="metric-value blue" style={{ fontFamily: 'var(--font-mono)' }}>
            {metrics?.total_interventions ?? metrics?.total_cases ?? 0}
          </div>
          <div className="metric-sub">0 regulatory violations (100% compliance)</div>
        </div>
      </div>

      {/* Live AI Decision Surface */}
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <AiDecisionSurface
          signal={
            decisionExecuted
              ? 'Corridor stabilized: 100% of traffic successfully rerouted to secondary ICICI rail.'
              : 'High failure rate detected on HDFC UPI Autopay corridors (Error: U19/U30 Rate: 16.4%)'
          }
          rootCause={
            decisionExecuted
              ? 'RESOLVED via Secondary Corridor Routing'
              : 'ISSUER_NODE_TIMEOUT (HDFC Core Banking API latency spike > 1850ms)'
          }
          confidenceScore={0.94}
          reasoning="Historical mandate execution patterns show 98.4% success if rerouted to ICICI corridor. Policy Governor validates zero-friction intervention under RBI circular."
          policyStatus={decisionExecuted ? 'EXECUTED' : 'APPROVED'}
          recommendedAction={
            decisionExecuted
              ? 'Autonomous switch completed. Corridors healthy.'
              : 'Autonomous switch: Reroute mandate retry sequence to ICICI backup gateway and execute failover.'
          }
          onExecute={decisionExecuted ? undefined : handleExecuteDecision}
        />
      </div>

      {/* Two Columns: Scenarios Breakdown + Root Cause Matrix */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
        {/* Scenarios Recovery Table */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <div>
              <div className="card-title" style={{ margin: 0 }}>Recovery Scenarios</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Performance across autonomous payment recovery modules
              </div>
            </div>
            <button
              onClick={() => navigate('/recovery')}
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span>View Queue</span>
              <ChevronRight size={12} />
            </button>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Scenario</th>
                  <th>Cases</th>
                  <th style={{ textAlign: 'right' }}>At Risk</th>
                  <th style={{ textAlign: 'right' }}>Recovered</th>
                  <th>Yield</th>
                </tr>
              </thead>
              <tbody>
                {byScenario.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--space-5)', color: 'var(--text-muted)' }}>
                      No scenarios found in telemetry stream
                    </td>
                  </tr>
                ) : (
                  byScenario.map((s) => {
                    const scenarioName = s.scenario || s.scenario_type || 'GENERAL';
                    const caseCount = s.count ?? s.case_count ?? 0;
                    const atRiskAmt = s.amount_at_risk || 0;
                    const recAmt = s.amount_recovered || 0;
                    const scenarioTotal = atRiskAmt + recAmt;
                    const rate = scenarioTotal > 0 ? Math.round((recAmt / scenarioTotal) * 100) : 0;
                    const route = getScenarioRoute(scenarioName);
                    return (
                      <tr
                        key={scenarioName}
                        onClick={() => navigate(route)}
                        style={{ cursor: 'pointer' }}
                        title={`Navigate to ${scenarioName.replace(/_/g, ' ')} operational module`}
                      >
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {getScenarioIcon(scenarioName)}
                            </div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                              {scenarioName.replace(/_/g, ' ')}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-subtle">{caseCount}</span>
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--color-danger)' }}>
                          {formatINR(atRiskAmt)}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--color-success)', fontWeight: 600 }}>
                          {formatINR(recAmt)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '36px', height: '6px', background: 'var(--border-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(rate, 100)}%`, height: '100%', background: rate >= 60 ? 'var(--color-success)' : 'var(--color-warning)' }} />
                            </div>
                            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>{rate}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Root Cause Diagnosis Breakdown */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <div>
              <div className="card-title" style={{ margin: 0 }}>Root-Cause Intelligence</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                AI classification of technical vs behavioral failure causes
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {byRootCause.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-5)', color: 'var(--text-muted)' }}>
                No root cause data available
              </div>
            ) : (
              byRootCause.slice(0, 5).map((r) => {
                const causeName = r.root_cause || 'UNKNOWN';
                const count = r.count ?? r.case_count ?? 0;
                const vol = r.volume ?? r.amount_at_risk ?? 0;
                return (
                  <div
                    key={causeName}
                    style={{
                      background: 'var(--bg-surface)',
                      padding: 'var(--space-3) var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {causeName.replace(/_/g, ' ')}
                      </span>
                      <span className="badge badge-primary">{count} cases</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      <span>Impact Volume: <strong style={{ color: 'var(--color-danger)', fontFamily: 'var(--font-mono)' }}>{formatINR(vol)}</strong></span>
                      <span>Recovery Path: <strong style={{ color: 'var(--color-brand)' }}>Autonomous Routing</strong></span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Live Activity & Cryptographic Audit Stream */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <div>
            <div className="card-title" style={{ margin: 0 }}>Live Autonomous Decision Stream</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Real-time audit ledger of AI diagnosis, policy checks, and autonomous interventions
            </div>
          </div>
          <button
            onClick={() => navigate('/audit')}
            className="btn btn-secondary"
            style={{ fontSize: '11px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <span>Full Audit Ledger</span>
            <ChevronRight size={12} />
          </button>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Event Type</th>
                <th>Reasoning / Context</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--space-5)', color: 'var(--text-muted)' }}>
                    No recent activity records found
                  </td>
                </tr>
              ) : (
                recentActivity.slice(0, 6).map((evt) => {
                  const timestampStr = evt.timestamp || evt.created_at;
                  return (
                    <tr key={evt.id}>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {timestampStr ? formatRelativeTime(timestampStr) : 'Just now'}
                      </td>
                      <td>
                        <span className={`badge ${evt.actor.includes('AIRA') ? 'badge-primary' : 'badge-subtle'}`}>
                          {evt.actor}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>{evt.action}</td>
                      <td>
                        <span className="badge badge-subtle">{evt.event_type}</span>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '350px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {evt.reason || 'Decision verified against regulatory guardrails.'}
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

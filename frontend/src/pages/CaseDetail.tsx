import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldCheck,
  Play,
} from 'lucide-react';
import { api } from '../api/client';
import type { RecoveryCaseDetail } from '../api/client';
import { useAiraState } from '../context/AiraStateContext';
import { AiDecisionSurface } from '../components/AiDecisionSurface';
import { formatINR, formatPercent, formatDate } from '../utils/formatters';

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { refreshMetrics, notify } = useAiraState();
  const [caseData, setCaseData] = useState<RecoveryCaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'ai' | 'policy' | 'interventions' | 'audit'>('overview');

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await api.case(id);
      setCaseData(data);
    } catch (e: any) {
      notify('Failed to load case', e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleRun = async () => {
    if (!id) return;
    setRunning(true);
    try {
      await api.runCase(id);
      notify('Autonomous Engine Executed', 'Case processed through AI, Policy Governor, and Intervention Pipeline.', 'success');
      await refreshMetrics();
      await load();
    } catch (e: any) {
      notify('Execution Failed', e.message, 'error');
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="page-body">
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>
          Loading case details...
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="page-body">
        <div className="card text-center" style={{ padding: 'var(--space-8)' }}>
          <h3>Case not found</h3>
          <button onClick={() => navigate('/recovery')} className="btn btn-secondary" style={{ marginTop: 'var(--space-3)' }}>
            Back to Queue
          </button>
        </div>
      </div>
    );
  }

  const c = caseData;
  const lastAI = (c.ai_recommendations || [])[c.ai_recommendations.length - 1];
  const lastPolicy = (c.policy_decisions || [])[c.policy_decisions.length - 1];

  return (
    <div className="page-body">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/recovery')} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px' }}>
            <ArrowLeft size={14} /> Back
          </button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-primary)', fontWeight: 600 }}>
            {c.id}
          </span>
          <span className={`badge ${c.status === 'RECOVERED' ? 'badge-success' : 'badge-primary'}`}>
            {c.status}
          </span>
          <span className="badge badge-subtle">
            {c.scenario_type.replace(/_/g, ' ')}
          </span>
        </div>

        <button
          onClick={handleRun}
          disabled={running}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Play size={14} className={running ? 'spin-icon' : ''} />
          <span>{running ? 'Running Engine...' : 'Run Recovery Engine'}</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 'var(--space-5)' }}>
        <div className="metric-card">
          <div className="metric-label">Amount at Risk</div>
          <div className="metric-value red" style={{ fontFamily: 'var(--font-mono)' }}>
            {formatINR(c.amount_at_risk)}
          </div>
          <div className="metric-sub">{c.scenario_type.replace(/_/g, ' ')}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Amount Recovered</div>
          <div className="metric-value green" style={{ fontFamily: 'var(--font-mono)' }}>
            {formatINR(c.amount_recovered)}
          </div>
          <div className="metric-sub">
            {formatPercent(c.amount_at_risk > 0 ? (c.amount_recovered / c.amount_at_risk) * 100 : 0)} recovered
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">AI Recommendation</div>
          <div className="metric-value blue" style={{ fontSize: '15px' }}>
            {lastAI?.recommended_action || 'Pending Analysis'}
          </div>
          <div className="metric-sub">{lastAI ? `${formatPercent(lastAI.confidence_score * 100)} confidence` : 'Not yet analyzed'}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Policy Decision</div>
          <div className="metric-value purple" style={{ fontSize: '15px' }}>
            {lastPolicy?.decision || 'Pending Evaluation'}
          </div>
          <div className="metric-sub">{lastPolicy?.rule_applied || 'Rule Governor'}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', borderBottom: '1px solid var(--border-subtle)', marginBottom: 'var(--space-4)', overflowX: 'auto' }}>
        {(['overview', 'ai', 'policy', 'interventions', 'audit'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--color-primary)' : 'var(--text-secondary)',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              textTransform: 'capitalize',
              whiteSpace: 'nowrap',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-5)' }}>
          <div className="card">
            <div className="card-title">Case Metadata</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Scenario Type</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.scenario_type.replace(/_/g, ' ')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Root Cause</span>
                <span style={{ fontWeight: 600, color: 'var(--color-warning)' }}>{c.root_cause?.replace(/_/g, ' ') || 'Determined during run'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Payment Method</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.payment_method || 'UPI / Gateway'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Created At</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{formatDate(c.created_at)}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Customer Context</div>
            {c.customer ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Name</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.customer.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Email</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{c.customer.email}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Phone</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{c.customer.phone || '+91 98201 44521'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Language Preference</span>
                  <span style={{ textTransform: 'capitalize' }}>{c.customer.language_preference || 'Hinglish / English'}</span>
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)' }}>No customer record attached</div>
            )}
          </div>
        </div>
      )}

      {/* AI Tab */}
      {activeTab === 'ai' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {(!c.ai_recommendations || c.ai_recommendations.length === 0) ? (
            <div className="card text-center" style={{ padding: 'var(--space-8)' }}>
              <div>No AI recommendations generated yet.</div>
              <button onClick={handleRun} className="btn btn-primary" style={{ marginTop: 'var(--space-3)' }}>
                Run AI Recovery Analysis
              </button>
            </div>
          ) : (
            c.ai_recommendations.map((ai) => (
              <AiDecisionSurface
                key={ai.id}
                signal={`Payment rejection event for ${c.customer_name || 'Customer'} on ${c.payment_method || 'UPI'}`}
                rootCause={c.root_cause || 'TRANSACTION_TIMEOUT'}
                confidenceScore={ai.confidence_score}
                reasoning={ai.reasoning}
                policyStatus="APPROVED"
                recommendedAction={ai.recommended_action}
              />
            ))
          )}
        </div>
      )}

      {/* Policy Tab */}
      {activeTab === 'policy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {(c.policy_decisions || []).length === 0 ? (
            <div className="card" style={{ padding: 'var(--space-5)', textAlign: 'center', color: 'var(--text-muted)' }}>
              No policy decisions recorded
            </div>
          ) : (
            (c.policy_decisions || []).map((pol) => (
              <div key={pol.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={16} color="var(--color-primary)" />
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Rule: {pol.rule_applied}</span>
                  </div>
                  <span className={`badge ${pol.decision === 'ALLOW' || pol.decision === 'APPROVED' ? 'badge-success' : 'badge-danger'}`}>
                    {pol.decision}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{pol.reason}</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Interventions Tab */}
      {activeTab === 'interventions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {(c.interventions || []).length === 0 ? (
            <div className="card" style={{ padding: 'var(--space-5)', textAlign: 'center', color: 'var(--text-muted)' }}>
              No interventions logged yet
            </div>
          ) : (
            (c.interventions || []).map((inv) => (
              <div key={inv.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{inv.action}</span>
                  <span className={`badge ${inv.result === 'SUCCESS' ? 'badge-success' : 'badge-primary'}`}>
                    {inv.result}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Channel: {inv.channel} · Result: {inv.notes || 'Completed'}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Audit Tab */}
      {activeTab === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {(c.audit_events || []).length === 0 ? (
            <div className="card" style={{ padding: 'var(--space-5)', textAlign: 'center', color: 'var(--text-muted)' }}>
              No audit log entries for this case
            </div>
          ) : (
            (c.audit_events || []).map((evt) => (
              <div key={evt.id} style={{ padding: 'var(--space-3)', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{evt.action}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{evt.actor} · {evt.reason}</div>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                  {formatDate(evt.timestamp)}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

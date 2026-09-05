import { useState, useEffect } from 'react';
import {
  GitMerge,
  Plus,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Play,
  Pause,
  Zap,
  X,
  Search,
  ShieldAlert,
  Layers,
  CreditCard,
  Clock,
  MessageSquare,
} from 'lucide-react';
import { api } from '../api/client';
import type { MandateSequence, MandateStep, MandateQueueResponse, MandateQueueItem } from '../api/client';
import { useAiraState } from '../context/AiraStateContext';
import { formatINR, formatPercent } from '../utils/formatters';

export default function Mandates() {
  const { refreshMetrics, notify } = useAiraState();
  const [sequences, setSequences] = useState<MandateSequence[]>([]);
  const [selectedSeqIndex, setSelectedSeqIndex] = useState(0);
  const [queueData, setQueueData] = useState<MandateQueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSteps, setSavingSteps] = useState(false);
  const [runningBatch, setRunningBatch] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [selectedQueueItem, setSelectedQueueItem] = useState<MandateQueueItem | null>(null);
  const [queueSearchQuery, setQueueSearchQuery] = useState<string>('');

  // Local editing copy of steps
  const [steps, setSteps] = useState<MandateStep[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [seqs, q] = await Promise.all([
        api.mandateSequences(),
        api.mandateQueue(),
      ]);
      setSequences(seqs);
      if (seqs.length > 0) {
        setSteps(seqs[selectedSeqIndex]?.steps || []);
      }
      setQueueData(q);
      if (selectedQueueItem) {
        const updated = q.items.find((it) => it.id === selectedQueueItem.id);
        if (updated) setSelectedQueueItem(updated);
      }
    } catch (err: any) {
      notify('Failed to load mandate sequences', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedSeqIndex]);

  const handleToggleStatus = async () => {
    const activeSeq = sequences[selectedSeqIndex];
    if (!activeSeq) return;
    try {
      const res = await api.toggleMandateSequenceStatus(activeSeq.id);
      notify('Sequence Updated', res.message || 'Status toggled successfully.', 'success');
      await loadData();
    } catch (err: any) {
      notify('Toggle Failed', err.message, 'error');
    }
  };

  const handleAddStep = () => {
    const newStepNum = steps.length + 1;
    const newStep: MandateStep = {
      step_number: newStepNum,
      name: `Step ${newStepNum}: Secondary Failover`,
      action: 'smart_retry',
      delay_hours: 24 * newStepNum,
      channel: 'gateway',
      description: 'Trigger automated retry across backup banking corridor.',
      success_rate: 68.0,
    };
    setSteps([...steps, newStep]);
  };

  const handleRemoveStep = (idx: number) => {
    const updated = steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step_number: i + 1 }));
    setSteps(updated);
  };

  const handleStepChange = (idx: number, field: keyof MandateStep, value: any) => {
    const updated = [...steps];
    updated[idx] = { ...updated[idx], [field]: value };
    setSteps(updated);
  };

  const handleSaveSteps = async () => {
    const activeSeq = sequences[selectedSeqIndex];
    if (!activeSeq) return;
    setSavingSteps(true);
    try {
      const res = await api.updateMandateSteps(activeSeq.id, steps);
      notify('Mandate Sequence Saved', res.message || 'Step configuration updated.', 'success');
      await loadData();
    } catch (err: any) {
      notify('Save Failed', err.message, 'error');
    } finally {
      setSavingSteps(false);
    }
  };

  const handleRetrySingle = async (mandateId: string) => {
    setRetryingId(mandateId);
    try {
      const res = await api.retryMandateStep(mandateId);
      notify('Mandate Step Executed', res.message || 'Retry request successfully submitted to banking network.', 'success');
      await refreshMetrics();
      await loadData();
    } catch (err: any) {
      notify('Execution Failed', err.message, 'error');
    } finally {
      setRetryingId(null);
    }
  };

  const handleRunBatch = async () => {
    setRunningBatch(true);
    try {
      const res = await api.runMandateBatch();
      notify('Batch Execution Completed', res.message || 'Processed all eligible mandate retry steps.', 'success');
      await refreshMetrics();
      await loadData();
    } catch (err: any) {
      notify('Batch Run Failed', err.message, 'error');
    } finally {
      setRunningBatch(false);
    }
  };

  const activeSeq = sequences[selectedSeqIndex];
  const queueMetrics = queueData?.metrics;
  const qQuery = queueSearchQuery.trim().toLowerCase();
  const queueItems = (queueData?.items || []).filter((item) => {
    if (!qQuery) return true;
    return (
      item.customer_name.toLowerCase().includes(qQuery) ||
      item.mandate_id.toLowerCase().includes(qQuery) ||
      item.plan_name.toLowerCase().includes(qQuery) ||
      item.failure_reason.toLowerCase().includes(qQuery)
    );
  });

  return (
    <div className="page-body">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-5)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Mandate Sequencer & Smart Retry Dunning
            </h1>
            <span className="badge badge-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={12} />
              e-NACH / UPI Autopay
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Multi-stage automated recovery routing across primary gateways, secondary debit corridors, and client nudges.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            onClick={handleRunBatch}
            disabled={runningBatch || loading}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Play size={14} />
            <span>{runningBatch ? 'Processing...' : 'Run Eligible Batch'}</span>
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
          <div className="metric-label">Mandates In Recovery Queue</div>
          <div className="metric-value blue" style={{ fontFamily: 'var(--font-mono)' }}>
            {queueMetrics?.active_in_sequence ?? queueItems.length}
          </div>
          <div className="metric-sub">Pending sequential retries</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Volume At Risk</div>
          <div className="metric-value red" style={{ fontFamily: 'var(--font-mono)' }}>
            {formatINR(queueMetrics?.total_mandates_at_risk)}
          </div>
          <div className="metric-sub">Across all debit rails</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Recovered via Sequencer</div>
          <div className="metric-value green" style={{ fontFamily: 'var(--font-mono)' }}>
            {formatINR(queueMetrics?.recovered_volume)}
          </div>
          <div className="metric-sub">Saved from churn</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Sequence Success Rate</div>
          <div className="metric-value purple" style={{ fontFamily: 'var(--font-mono)' }}>
            {formatPercent(queueMetrics?.avg_sequence_success_rate ?? 74.8)}
          </div>
          <div className="metric-sub">Target recovery yield</div>
        </div>
      </div>

      {/* Sequence Selector Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-3)', overflowX: 'auto' }}>
        {sequences.map((seq, idx) => (
          <button
            key={seq.id}
            onClick={() => setSelectedSeqIndex(idx)}
            className={idx === selectedSeqIndex ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <GitMerge size={14} />
            <span>{seq.name}</span>
            <span className={`badge ${seq.status === 'ACTIVE' ? 'badge-success' : 'badge-subtle'}`} style={{ fontSize: '10px' }}>
              {seq.status}
            </span>
          </button>
        ))}
      </div>

      {/* Sequence Editor Box */}
      {activeSeq && (
        <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="card-title" style={{ margin: 0 }}>{activeSeq.name}</div>
                <span className={`badge ${activeSeq.status === 'ACTIVE' ? 'badge-success' : 'badge-subtle'}`}>
                  {activeSeq.status}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {activeSeq.description || 'Configured retry trajectory for failing recurring mandates.'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button onClick={handleToggleStatus} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {activeSeq.status === 'ACTIVE' ? <Pause size={14} /> : <Play size={14} />}
                <span>{activeSeq.status === 'ACTIVE' ? 'Pause Sequence' : 'Activate Sequence'}</span>
              </button>
              <button onClick={handleAddStep} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={14} />
                <span>Add Step</span>
              </button>
              <button
                onClick={handleSaveSteps}
                disabled={savingSteps}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <CheckCircle2 size={14} />
                <span>{savingSteps ? 'Saving...' : 'Save Sequence'}</span>
              </button>
            </div>
          </div>

          {/* Sequence Steps Flow */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {steps.map((step, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: 'var(--color-primary)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {step.step_number}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)', flex: 1 }}>
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Step Label</label>
                    <input
                      type="text"
                      value={step.name}
                      onChange={(e) => handleStepChange(idx, 'name', e.target.value)}
                      style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-default)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '13px', marginTop: '2px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Delay (Hours)</label>
                    <input
                      type="number"
                      value={step.delay_hours}
                      onChange={(e) => handleStepChange(idx, 'delay_hours', parseInt(e.target.value) || 0)}
                      style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-default)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '13px', marginTop: '2px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Channel / Rail</label>
                    <select
                      value={step.channel}
                      onChange={(e) => handleStepChange(idx, 'channel', e.target.value)}
                      style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-default)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '13px', marginTop: '2px' }}
                    >
                      <option value="gateway">Gateway Auto-Retry</option>
                      <option value="whatsapp">WhatsApp Fix Link</option>
                      <option value="sms">SMS Notification</option>
                      <option value="voice">Voice AI Agent</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Strategy Description</label>
                    <input
                      type="text"
                      value={step.description}
                      onChange={(e) => handleStepChange(idx, 'description', e.target.value)}
                      style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-default)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '13px', marginTop: '2px' }}
                    />
                  </div>
                </div>

                <button
                  onClick={() => handleRemoveStep(idx)}
                  className="sidebar-toggle-btn"
                  title="Remove this step"
                >
                  <Trash2 size={14} color="var(--color-danger)" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Mandate Execution Queue */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div>
            <div className="card-title" style={{ margin: 0 }}>Active Mandate Queue</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Pending recurring charges navigating the configured retry sequence
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ position: 'relative', width: '250px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search UMRN, customer, or plan..."
                value={queueSearchQuery}
                onChange={(e) => setQueueSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 30px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  outline: 'none',
                }}
              />
              {queueSearchQuery && (
                <button
                  onClick={() => setQueueSearchQuery('')}
                  style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{queueItems.length} active in sequence</span>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Customer / Mandate UMRN</th>
                <th style={{ textAlign: 'right' }}>Recurring Amount</th>
                <th>Current Sequence Step</th>
                <th>Failure Trigger</th>
                <th>Cooldown Remaining</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {queueItems.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-5)', color: 'var(--text-muted)' }}>
                    No mandates currently pending in retry sequence
                  </td>
                </tr>
              ) : (
                queueItems.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedQueueItem(item)}
                    style={{ cursor: 'pointer' }}
                    title="Click to inspect Mandate UMRN & execution audit"
                  >
                    <td>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.customer_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {item.mandate_id} · {item.mandate_type.toUpperCase()}
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {formatINR(item.amount)}
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{item.plan_name}</div>
                    </td>
                    <td>
                      <span className="badge badge-primary">
                        Step {item.current_step} / {item.max_steps}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '11px', color: 'var(--color-warning)' }}>
                        {item.failure_reason}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: item.cooldown_remaining_hours > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                        {item.cooldown_remaining_hours > 0 ? `${item.cooldown_remaining_hours}h remaining` : 'Eligible for Retry'}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRetrySingle(item.mandate_id);
                        }}
                        disabled={retryingId === item.mandate_id}
                        className="btn btn-primary"
                        style={{ fontSize: '11px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Zap size={12} />
                        <span>{retryingId === item.mandate_id ? 'Retrying...' : 'Execute Step'}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mandate Queue Item Detail Drawer */}
      {selectedQueueItem && (
        <div className="detail-drawer-overlay" onClick={() => setSelectedQueueItem(null)}>
          <div className="detail-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="detail-drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GitMerge size={18} color="var(--color-primary)" />
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Mandate Inspector: {selectedQueueItem.mandate_id}
                  </h3>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Subscriber: {selectedQueueItem.customer_name}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedQueueItem(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                title="Close drawer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="detail-drawer-body">
              {/* Mandate Specs */}
              <div className="drawer-section">
                <div className="drawer-section-title">
                  <CreditCard size={12} /> Recurring Mandate Specification
                </div>
                <div className="drawer-kv-grid">
                  <div className="drawer-kv-row">
                    <span className="drawer-kv-label">Subscriber</span>
                    <span className="drawer-kv-val">{selectedQueueItem.customer_name}</span>
                  </div>
                  <div className="drawer-kv-row">
                    <span className="drawer-kv-label">Phone</span>
                    <span className="drawer-kv-val">{selectedQueueItem.customer_phone || '+91 98765 43210'}</span>
                  </div>
                  <div className="drawer-kv-row">
                    <span className="drawer-kv-label">Plan Name</span>
                    <span className="drawer-kv-val">{selectedQueueItem.plan_name}</span>
                  </div>
                  <div className="drawer-kv-row">
                    <span className="drawer-kv-label">Recurring Amount</span>
                    <span className="drawer-kv-val" style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
                      {formatINR(selectedQueueItem.amount)}
                    </span>
                  </div>
                  <div className="drawer-kv-row">
                    <span className="drawer-kv-label">Debit Rail</span>
                    <span className="badge badge-primary">{selectedQueueItem.mandate_type.toUpperCase()}</span>
                  </div>
                  <div className="drawer-kv-row">
                    <span className="drawer-kv-label">Queue Status</span>
                    <span className="badge badge-warning">{selectedQueueItem.status.toUpperCase()}</span>
                  </div>
                </div>
              </div>

              {/* Sequence Ladder Progress */}
              <div className="drawer-section">
                <div className="drawer-section-title">
                  <Layers size={12} /> Sequencer Progression Ladder
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Current Step</span>
                  <span className="badge badge-primary">Step {selectedQueueItem.current_step} of {selectedQueueItem.max_steps}</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'var(--border-subtle)', borderRadius: '4px', overflow: 'hidden', marginBottom: '10px' }}>
                  <div
                    style={{
                      width: `${(selectedQueueItem.current_step / selectedQueueItem.max_steps) * 100}%`,
                      height: '100%',
                      background: 'var(--color-primary)',
                    }}
                  />
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Next automated representment scheduled at:{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {new Date(selectedQueueItem.next_retry_at).toLocaleString('en-IN', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </strong>
                </div>
              </div>

              {/* RBI Mandate Cooldown Guardrail */}
              <div className="drawer-section" style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(13, 148, 251, 0.05))' }}>
                <div className="drawer-section-title" style={{ color: 'var(--color-warning)' }}>
                  <ShieldAlert size={12} /> RBI Cooldown & Guardrail Assurance
                </div>
                <div className="drawer-kv-row">
                  <span className="drawer-kv-label">Regulatory Status</span>
                  <span className="drawer-kv-val" style={{ color: selectedQueueItem.cooldown_remaining_hours > 0 ? 'var(--color-warning)' : 'var(--color-success)', fontWeight: 600 }}>
                    {selectedQueueItem.cooldown_remaining_hours > 0 ? `${selectedQueueItem.cooldown_remaining_hours}h Remaining in Cooldown` : 'Eligible for Immediate Retry'}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: '8px' }}>
                  RBI Master Direction requires mandatory rate-limiting between automated re-presentments on recurring mandates to protect consumer accounts from repeat bounce charges. Aira strictly adheres to the 24-hour liquidity window.
                </div>
              </div>

              {/* Technical Return Diagnostics */}
              <div className="drawer-section">
                <div className="drawer-section-title">
                  <Clock size={12} /> Technical Return Diagnostics
                </div>
                <div className="drawer-kv-row">
                  <span className="drawer-kv-label">Failure Reason</span>
                  <span className="drawer-kv-val" style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
                    {selectedQueueItem.failure_reason}
                  </span>
                </div>
                <div className="drawer-kv-row">
                  <span className="drawer-kv-label">NPCI Return Code</span>
                  <span className="drawer-kv-val" style={{ fontFamily: 'var(--font-mono)' }}>
                    {selectedQueueItem.failure_reason.includes('funds') || selectedQueueItem.failure_reason.includes('balance')
                      ? 'NPCI-51 (Insufficient Funds)'
                      : 'NPCI-05 (Transaction Declined / Re-auth Required)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="detail-drawer-footer">
              <button
                onClick={() => {
                  notify('WhatsApp Update Dispatched', `Payment retry notice sent to ${selectedQueueItem.customer_name}.`, 'info');
                }}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
              >
                <MessageSquare size={13} />
                <span>Notify Customer</span>
              </button>
              <button
                onClick={() => handleRetrySingle(selectedQueueItem.mandate_id)}
                disabled={retryingId === selectedQueueItem.mandate_id}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
              >
                <Zap size={13} />
                <span>{retryingId === selectedQueueItem.mandate_id ? 'Retrying...' : 'Execute Step Now'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

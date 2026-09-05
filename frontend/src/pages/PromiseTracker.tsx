import { useState, useEffect } from 'react';
import {
  CalendarCheck,
  CheckCircle2,
  AlertTriangle,
  Plus,
  RefreshCw,
  Sparkles,
  X,
  PhoneCall,
  MessageSquare,
  FileText,
  Search,
  User,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../api/client';
import type { PromisesResponse, PromiseToPay } from '../api/client';
import { useAiraState } from '../context/AiraStateContext';
import { formatINR, formatPercent, formatDate } from '../utils/formatters';

export default function PromiseTracker() {
  const { refreshMetrics, notify } = useAiraState();
  const [data, setData] = useState<PromisesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPromise, setSelectedPromise] = useState<PromiseToPay | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New promise form
  const [newAmount, setNewAmount] = useState<number>(25000);
  const [newDate, setNewDate] = useState<string>('');
  const [newSource, setNewSource] = useState<'voice' | 'dunning' | 'whatsapp' | 'manual'>('whatsapp');
  const [newNotes, setNewNotes] = useState<string>('');
  const [creating, setCreating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.promises();
      setData(res);
      if (selectedPromise) {
        const updated = res.items.find((it) => it.id === selectedPromise.id);
        if (updated) setSelectedPromise(updated);
      }
    } catch (err: any) {
      notify('Failed to load promises', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const d = new Date();
    d.setDate(d.getDate() + 3);
    setNewDate(d.toISOString().split('T')[0]);
  }, []);

  const handleUpdateStatus = async (id: string, status: 'kept' | 'broken' | 'pending') => {
    try {
      const res = await api.updatePromise(id, { status });
      notify('Promise Status Updated', res.message || `Promise marked as ${status}.`, 'success');
      await refreshMetrics();
      await loadData();
    } catch (err: any) {
      notify('Update Failed', err.message, 'error');
    }
  };

  const handleSendFollowup = async (id: string) => {
    try {
      const res = await api.sendPromiseFollowUp(id, 'whatsapp');
      notify('Follow-up Dispatched', res.message || 'Payment reminder message dispatched.', 'success');
      await loadData();
    } catch (err: any) {
      notify('Dispatch Failed', err.message, 'error');
    }
  };

  const handleCreatePromise = async () => {
    setCreating(true);
    try {
      const res = await api.createPromise({
        amount: newAmount,
        promise_date: newDate,
        promise_source: newSource,
        notes: newNotes || 'Customer promised payment settlement.',
      });
      notify('Promise Created', res.message || 'Payment commitment recorded.', 'success');
      setShowCreateModal(false);
      setNewNotes('');
      await refreshMetrics();
      await loadData();
    } catch (err: any) {
      notify('Creation Failed', err.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const metrics = data?.metrics;
  const pQuery = searchQuery.trim().toLowerCase();
  const items: PromiseToPay[] = (data?.items || []).filter((p) => {
    const matchesStatus = statusFilter === 'ALL' || p.status.toLowerCase() === statusFilter.toLowerCase();
    const matchesSearch =
      !pQuery ||
      (p.customer_name && p.customer_name.toLowerCase().includes(pQuery)) ||
      p.id.toLowerCase().includes(pQuery) ||
      (p.case_id && p.case_id.toLowerCase().includes(pQuery)) ||
      (p.notes && p.notes.toLowerCase().includes(pQuery));
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="page-body">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-5)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Promise-to-Pay Fulfillment Tracker
            </h1>
            <span className="badge badge-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={12} />
              AI Commitment Monitor
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Track, audit, and follow up on customer payment commitments captured across voice and messaging channels.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={14} />
            <span>Record Promise</span>
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
          <div className="metric-label">Total Payment Commitments</div>
          <div className="metric-value blue" style={{ fontFamily: 'var(--font-mono)' }}>
            {metrics?.total_promises_count ?? 0}
          </div>
          <div className="metric-sub">Across all recovery channels</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Committed Volume</div>
          <div className="metric-value purple" style={{ fontFamily: 'var(--font-mono)' }}>
            {formatINR(metrics?.total_active_promised)}
          </div>
          <div className="metric-sub">Pending settlement</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Fulfilled Commitments</div>
          <div className="metric-value green" style={{ fontFamily: 'var(--font-mono)' }}>
            {formatINR(metrics?.total_fulfilled)}
          </div>
          <div className="metric-sub">{formatPercent(metrics?.fulfillment_rate)} fulfillment rate</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Broken Commitments</div>
          <div className="metric-value red" style={{ fontFamily: 'var(--font-mono)' }}>
            {metrics?.total_broken ?? 0}
          </div>
          <div className="metric-sub">Requires autonomous escalation</div>
        </div>
      </div>

      {/* Main Ledger Card */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {['ALL', 'PENDING', 'KEPT', 'BROKEN'].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                style={{
                  background: statusFilter === tab ? 'var(--color-primary-dim)' : 'var(--bg-surface)',
                  color: statusFilter === tab ? 'var(--color-primary)' : 'var(--text-secondary)',
                  border: 'none',
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ position: 'relative', width: '250px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search customer, case, or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Showing {items.length} promises</span>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Customer / Case</th>
                <th style={{ textAlign: 'right' }}>Promised Amount</th>
                <th>Commitment Date</th>
                <th>Channel Source</th>
                <th>Notes / Context</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 'var(--space-5)', color: 'var(--text-muted)' }}>
                    No promises found matching current filter
                  </td>
                </tr>
              ) : (
                items.map((p) => {
                  const isKept = p.status.toLowerCase() === 'kept';
                  const isBroken = p.status.toLowerCase() === 'broken';
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedPromise(p)}
                      style={{ cursor: 'pointer' }}
                      title="Click row to inspect commitment details & audit trail"
                    >
                      <td>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.customer_name || 'Enterprise Client'}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {p.case_id || p.invoice_id || p.id}
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {formatINR(p.amount)}
                      </td>
                      <td>
                        <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                          {formatDate(p.promise_date)}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-subtle" style={{ textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '4px', width: 'fit-content' }}>
                          {p.promise_source === 'voice' && <PhoneCall size={11} />}
                          {p.promise_source === 'whatsapp' && <MessageSquare size={11} />}
                          {p.promise_source === 'dunning' && <FileText size={11} />}
                          {p.promise_source}
                        </span>
                      </td>
                      <td style={{ maxWidth: '220px', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.notes || 'Payment committed on scheduled date.'}
                      </td>
                      <td>
                        <span className={`badge ${isKept ? 'badge-success' : isBroken ? 'badge-danger' : 'badge-primary'}`}>
                          {p.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                          {!isKept && !isBroken && (
                            <>
                              <button
                                onClick={() => handleSendFollowup(p.id)}
                                className="btn btn-secondary"
                                style={{ fontSize: '11px', padding: '4px 8px' }}
                                title="Send automated reminder via WhatsApp"
                              >
                                Remind
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(p.id, 'kept')}
                                className="btn btn-primary"
                                style={{ fontSize: '11px', padding: '4px 8px' }}
                                title="Mark payment fulfilled & kept"
                              >
                                Kept
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(p.id, 'broken')}
                                className="btn btn-secondary"
                                style={{ fontSize: '11px', padding: '4px 8px', color: 'var(--color-danger)' }}
                                title="Mark promise broken"
                              >
                                Broken
                              </button>
                            </>
                          )}
                          {isKept && (
                            <span style={{ fontSize: '11px', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <CheckCircle2 size={13} /> Fulfilled
                            </span>
                          )}
                          {isBroken && (
                            <span style={{ fontSize: '11px', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <AlertTriangle size={13} /> Broken
                            </span>
                          )}
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

      {/* Promise Detail Drawer */}
      {selectedPromise && (
        <div className="detail-drawer-overlay" onClick={() => setSelectedPromise(null)}>
          <div className="detail-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="detail-drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarCheck size={18} color="var(--color-primary)" />
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Commitment Inspector: {selectedPromise.id}
                  </h3>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Customer: {selectedPromise.customer_name || 'Enterprise Client'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedPromise(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                title="Close drawer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="detail-drawer-body">
              {/* Commitment Summary */}
              <div className="drawer-section">
                <div className="drawer-section-title">
                  <User size={12} /> Counterparty & Commitment Profile
                </div>
                <div className="drawer-kv-grid">
                  <div className="drawer-kv-row">
                    <span className="drawer-kv-label">Customer</span>
                    <span className="drawer-kv-val">{selectedPromise.customer_name || 'Enterprise Client'}</span>
                  </div>
                  <div className="drawer-kv-row">
                    <span className="drawer-kv-label">Source Channel</span>
                    <span className="badge badge-subtle">{selectedPromise.promise_source.toUpperCase()}</span>
                  </div>
                  <div className="drawer-kv-row">
                    <span className="drawer-kv-label">Linked Case / Invoice</span>
                    <span className="drawer-kv-val" style={{ fontFamily: 'var(--font-mono)' }}>
                      {selectedPromise.case_id || selectedPromise.invoice_id || 'Direct Commitment'}
                    </span>
                  </div>
                  <div className="drawer-kv-row">
                    <span className="drawer-kv-label">Current Status</span>
                    <span className={`badge ${selectedPromise.status === 'kept' ? 'badge-success' : selectedPromise.status === 'broken' ? 'badge-danger' : 'badge-primary'}`}>
                      {selectedPromise.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Financial Commitment Details */}
              <div className="drawer-section">
                <div className="drawer-section-title">
                  <Clock size={12} /> Settlement Economics & Due Date
                </div>
                <div className="drawer-kv-row">
                  <span className="drawer-kv-label">Promised Amount</span>
                  <span className="drawer-kv-val" style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: '15px' }}>
                    {formatINR(selectedPromise.amount)}
                  </span>
                </div>
                <div className="drawer-kv-row">
                  <span className="drawer-kv-label">Commitment Date</span>
                  <span className="drawer-kv-val">{formatDate(selectedPromise.promise_date)}</span>
                </div>
                <div className="drawer-kv-row">
                  <span className="drawer-kv-label">Recorded On</span>
                  <span className="drawer-kv-val">{selectedPromise.created_at ? formatDate(selectedPromise.created_at) : 'Active'}</span>
                </div>
              </div>

              {/* Notes & Transcript Context */}
              <div className="drawer-section">
                <div className="drawer-section-title">
                  <FileText size={12} /> Customer Context & Notes
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.5, background: 'var(--bg-surface)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  {selectedPromise.notes || 'Payment commitment recorded during customer engagement.'}
                </div>
              </div>

              {/* AI Follow-up Strategy */}
              <div className="drawer-section" style={{ background: 'linear-gradient(135deg, rgba(13, 148, 251, 0.08), rgba(4, 219, 124, 0.05))' }}>
                <div className="drawer-section-title" style={{ color: 'var(--color-primary)' }}>
                  <ShieldCheck size={12} /> Autonomous Follow-up Protocol
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  Aira schedules an automated gentle reminder 24 hours prior to settlement deadline via WhatsApp. If commitment expires without receipt, automated re-routing to the high-priority recovery ladder is triggered.
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="detail-drawer-footer">
              <button
                onClick={() => handleSendFollowup(selectedPromise.id)}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
              >
                <MessageSquare size={13} />
                <span>Send WhatsApp Follow-up</span>
              </button>
              {selectedPromise.status === 'pending' && (
                <>
                  <button
                    onClick={() => handleUpdateStatus(selectedPromise.id, 'broken')}
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-danger)' }}
                  >
                    <AlertTriangle size={13} />
                    <span>Mark Broken</span>
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedPromise.id, 'kept')}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
                  >
                    <CheckCircle2 size={13} />
                    <span>Mark Kept</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Record Promise Modal */}
      {showCreateModal && (
        <div className="notification-drawer-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="command-palette-modal" style={{ maxWidth: '480px', padding: 'var(--space-5)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Record New Promise-to-Pay</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Enter customer payment commitment details</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Promised Amount (₹)</label>
                <input
                  type="number"
                  value={newAmount}
                  onChange={(e) => setNewAmount(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '8px', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Promised Due Date</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '8px', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', marginTop: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Channel Source</label>
                <select
                  value={newSource}
                  onChange={(e) => setNewSource(e.target.value as any)}
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '8px', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', marginTop: '4px' }}
                >
                  <option value="whatsapp">WhatsApp Conversation</option>
                  <option value="voice">Voice AI Agent Call</option>
                  <option value="dunning">Dunning Email Notice</option>
                  <option value="manual">Manual Direct Contact</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Notes / Context</label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="e.g. Customer promised settlement post Friday audit."
                  rows={3}
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '8px', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', marginTop: '4px' }}
                />
              </div>

              <button
                onClick={handleCreatePromise}
                disabled={creating}
                className="btn btn-primary"
                style={{ marginTop: 'var(--space-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <CalendarCheck size={14} />
                <span>{creating ? 'Recording...' : 'Record Promise to System'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

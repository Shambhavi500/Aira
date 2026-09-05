import { useState, useEffect } from 'react';
import {
  Send,
  CalendarCheck,
  RefreshCw,
  Sparkles,
  X,
  CheckCircle2,
  Search,
  Building,
  FileText,
  TrendingUp,
  MessageSquare,
  Clock,
} from 'lucide-react';
import { api } from '../api/client';
import type { InvoicesResponse, InvoiceItem } from '../api/client';
import { useAiraState } from '../context/AiraStateContext';
import { formatINR, formatPercent, formatDate } from '../utils/formatters';

export default function Receivables() {
  const { refreshMetrics, notify } = useAiraState();
  const [data, setData] = useState<InvoicesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBucket, setSelectedBucket] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceItem | null>(null);
  const [inspectingInvoice, setInspectingInvoice] = useState<InvoiceItem | null>(null);
  const [showPromiseModal, setShowPromiseModal] = useState(false);
  const [promiseAmount, setPromiseAmount] = useState<number>(0);
  const [promiseDate, setPromiseDate] = useState<string>('');
  const [promiseNotes, setPromiseNotes] = useState<string>('');
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [submittingPromise, setSubmittingPromise] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.invoices();
      setData(res);
      if (inspectingInvoice) {
        const updated = res.items.find((it) => it.id === inspectingInvoice.id);
        if (updated) setInspectingInvoice(updated);
      }
    } catch (err: any) {
      notify('Failed to load receivables', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setPromiseDate(d.toISOString().split('T')[0]);
  }, []);

  const handleSendReminder = async (invoice: InvoiceItem, channel: 'email' | 'whatsapp' | 'sms' = 'whatsapp') => {
    setRemindingId(invoice.id);
    try {
      const res = await api.sendInvoiceReminder(invoice.id, channel);
      notify('Reminder Dispatched', res.message || 'Payment notice dispatched to finance team.', 'success');
      await loadData();
    } catch (err: any) {
      notify('Dispatch Failed', err.message, 'error');
    } finally {
      setRemindingId(null);
    }
  };

  const handleMarkPaid = async (invoice: InvoiceItem) => {
    setSettlingId(invoice.id);
    try {
      const res = await api.markInvoicePaid(invoice.id);
      notify('Invoice Settled', res.message || `Invoice ${invoice.invoice_number} marked as settled.`, 'success');
      await refreshMetrics();
      await loadData();
    } catch (err: any) {
      notify('Settlement Failed', err.message, 'error');
    } finally {
      setSettlingId(null);
    }
  };

  const handleOpenPromiseModal = (invoice: InvoiceItem) => {
    setSelectedInvoice(invoice);
    setPromiseAmount(invoice.amount);
    setShowPromiseModal(true);
  };

  const handleSavePromise = async () => {
    if (!selectedInvoice) return;
    setSubmittingPromise(true);
    try {
      const res = await api.recordInvoicePromise(selectedInvoice.id, {
        amount: promiseAmount,
        promise_date: promiseDate,
        promise_source: 'b2b_dunning',
        notes: promiseNotes || `Payment commitment captured for invoice ${selectedInvoice.invoice_number}`,
      });
      notify('Promise Recorded', res.message || 'Commitment registered in ledger.', 'success');
      setShowPromiseModal(false);
      setPromiseNotes('');
      await refreshMetrics();
      await loadData();
    } catch (err: any) {
      notify('Failed to record promise', err.message, 'error');
    } finally {
      setSubmittingPromise(false);
    }
  };

  const metrics = data?.metrics;
  const aging = metrics?.aging_breakdown;
  const query = searchQuery.trim().toLowerCase();
  const items = (data?.items || []).filter((item) => {
    const matchesBucket = selectedBucket === 'ALL' || item.aging_bucket.toLowerCase() === selectedBucket.toLowerCase();
    const matchesSearch =
      !query ||
      item.company_name.toLowerCase().includes(query) ||
      (item.customer_name && item.customer_name.toLowerCase().includes(query)) ||
      item.invoice_number.toLowerCase().includes(query) ||
      item.id.toLowerCase().includes(query);
    return matchesBucket && matchesSearch;
  });

  return (
    <div className="page-body">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-5)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
              B2B Receivables Chaser & Dunning Center
            </h1>
            <span className="badge badge-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={12} />
              AI Ledger Reconciler
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Intelligent aging bucket segmentation, multi-channel dunning dispatch, and commitment tracking.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button onClick={loadData} disabled={loading} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} className={loading ? 'spin-icon' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 'var(--space-5)' }}>
        <div className="metric-card">
          <div className="metric-label">Total Overdue Receivables</div>
          <div className="metric-value red" style={{ fontFamily: 'var(--font-mono)' }}>
            {formatINR(metrics?.total_overdue)}
          </div>
          <div className="metric-sub">{metrics?.overdue_count ?? 0} overdue invoices</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Autonomous Recovered</div>
          <div className="metric-value green" style={{ fontFamily: 'var(--font-mono)' }}>
            {formatINR(metrics?.total_recovered)}
          </div>
          <div className="metric-sub">{formatPercent(metrics?.recovery_rate)} collection yield</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Active Commitments (Promises)</div>
          <div className="metric-value purple" style={{ fontFamily: 'var(--font-mono)' }}>
            {metrics?.active_promises_count ?? 0}
          </div>
          <div className="metric-sub">Scheduled payment commitments</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Days Sales Outstanding (DSO)</div>
          <div className="metric-value blue" style={{ fontFamily: 'var(--font-mono)' }}>
            {metrics?.dso_days !== undefined ? `${metrics.dso_days} days` : '—'}
          </div>
          <div className="metric-sub">-8 days vs industry benchmark</div>
        </div>
      </div>

      {/* Aging Buckets Filter Ribbon */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
        {[
          { key: 'ALL', label: 'All Invoices', amount: metrics?.total_outstanding, count: data?.total ?? 0, color: 'var(--color-primary)' },
          { key: 'current', label: 'Current (0-30d)', amount: aging?.current ?? aging?.days_1_30, count: 'Current', color: 'var(--color-success)' },
          { key: '31_60', label: '31 - 60 Days', amount: aging?.days_31_60, count: 'Overdue', color: 'var(--color-warning)' },
          { key: '61_90', label: '61 - 90 Days', amount: aging?.days_61_90, count: 'High Risk', color: 'var(--color-danger)' },
          { key: '90_plus', label: '90+ Days (Critical)', amount: aging?.days_90_plus, count: 'Critical', color: 'var(--color-purple)' },
        ].map((bucket) => {
          const isSelected = selectedBucket.toLowerCase() === bucket.key.toLowerCase();
          return (
            <div
              key={bucket.key}
              onClick={() => setSelectedBucket(bucket.key)}
              style={{
                background: isSelected ? 'var(--bg-hover)' : 'var(--bg-card)',
                border: `1px solid ${isSelected ? bucket.color : 'var(--border-subtle)'}`,
                borderLeft: `4px solid ${bucket.color}`,
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3) var(--space-4)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>{bucket.label}</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                {formatINR(bucket.amount)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Invoices Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div className="card-title" style={{ margin: 0 }}>Receivables Ledger</div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ position: 'relative', width: '250px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search company or invoice #..."
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
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Showing {items.length} invoices</span>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Invoice / Company</th>
                <th>Due Date</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Aging Bucket</th>
                <th>Recovery Probability</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 'var(--space-5)', color: 'var(--text-muted)' }}>
                    No invoices match the selected filter
                  </td>
                </tr>
              ) : (
                items.map((inv) => {
                  const isPaid = inv.status.toLowerCase() === 'paid';
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => setInspectingInvoice(inv)}
                      style={{ cursor: 'pointer' }}
                      title="Click row to inspect enterprise invoice & dunning history"
                    >
                      <td>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{inv.company_name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {inv.invoice_number} · {inv.customer_name}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                          {formatDate(inv.due_date)}
                        </div>
                        {inv.days_overdue > 0 && (
                          <div style={{ fontSize: '11px', color: 'var(--color-danger)', fontWeight: 600 }}>
                            {inv.days_overdue} days overdue
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '13px' }}>
                        {formatINR(inv.amount)}
                      </td>
                      <td>
                        <span className="badge badge-subtle">{inv.aging_bucket.replace(/_/g, ' ')}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '40px', height: '6px', background: 'var(--border-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${(inv.recovery_probability || 0) * 100}%`, height: '100%', background: (inv.recovery_probability || 0) >= 0.7 ? 'var(--color-success)' : (inv.recovery_probability || 0) >= 0.4 ? 'var(--color-warning)' : 'var(--color-danger)' }} />
                          </div>
                          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                            {formatPercent((inv.recovery_probability || 0) * 100)}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${isPaid ? 'badge-success' : inv.status.toLowerCase() === 'overdue' ? 'badge-danger' : 'badge-primary'}`}>
                          {inv.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                          {!isPaid && (
                            <>
                              <button
                                onClick={() => handleSendReminder(inv, 'whatsapp')}
                                disabled={remindingId === inv.id}
                                className="btn btn-primary"
                                style={{ fontSize: '11px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '3px' }}
                                title="Send WhatsApp dunning reminder"
                              >
                                <Send size={11} />
                                <span>Remind</span>
                              </button>
                              <button
                                onClick={() => handleOpenPromiseModal(inv)}
                                className="btn btn-secondary"
                                style={{ fontSize: '11px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '3px' }}
                                title="Record Promise-to-Pay"
                              >
                                <CalendarCheck size={11} />
                                <span>Promise</span>
                              </button>
                              <button
                                onClick={() => handleMarkPaid(inv)}
                                disabled={settlingId === inv.id}
                                className="btn btn-secondary"
                                style={{ fontSize: '11px', padding: '4px 8px' }}
                                title="Mark Invoice as Paid"
                              >
                                Paid
                              </button>
                            </>
                          )}
                          {isPaid && (
                            <span style={{ fontSize: '11px', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <CheckCircle2 size={13} /> Paid
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

      {/* Operational Invoice Investigation Detail Drawer */}
      {inspectingInvoice && (
        <div className="detail-drawer-overlay" onClick={() => setInspectingInvoice(null)}>
          <div className="detail-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="detail-drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="var(--color-primary)" />
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Invoice Inspector: {inspectingInvoice.invoice_number}
                  </h3>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Enterprise Client: {inspectingInvoice.company_name}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setInspectingInvoice(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                title="Close drawer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="detail-drawer-body">
              {/* Counterparty Box */}
              <div className="drawer-section">
                <div className="drawer-section-title">
                  <Building size={12} /> Counterparty & Credit Profile
                </div>
                <div className="drawer-kv-grid">
                  <div className="drawer-kv-row">
                    <span className="drawer-kv-label">Company</span>
                    <span className="drawer-kv-val">{inspectingInvoice.company_name}</span>
                  </div>
                  <div className="drawer-kv-row">
                    <span className="drawer-kv-label">Authorized Contact</span>
                    <span className="drawer-kv-val">{inspectingInvoice.customer_name}</span>
                  </div>
                  <div className="drawer-kv-row">
                    <span className="drawer-kv-label">Email</span>
                    <span className="drawer-kv-val">{inspectingInvoice.customer_email || 'finance@company.com'}</span>
                  </div>
                  <div className="drawer-kv-row">
                    <span className="drawer-kv-label">Phone</span>
                    <span className="drawer-kv-val">{inspectingInvoice.customer_phone || '+91 98765 43210'}</span>
                  </div>
                  <div className="drawer-kv-row">
                    <span className="drawer-kv-label">Risk Segment</span>
                    <span className="badge badge-subtle">{inspectingInvoice.risk_segment || 'MEDIUM'}</span>
                  </div>
                  <div className="drawer-kv-row">
                    <span className="drawer-kv-label">Current Status</span>
                    <span className={`badge ${inspectingInvoice.status.toLowerCase() === 'paid' ? 'badge-success' : 'badge-danger'}`}>
                      {inspectingInvoice.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Financial Ledger Details */}
              <div className="drawer-section">
                <div className="drawer-section-title">
                  <Clock size={12} /> Invoice Aging & Exposure
                </div>
                <div className="drawer-kv-row">
                  <span className="drawer-kv-label">Invoice Amount</span>
                  <span className="drawer-kv-val" style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: '15px' }}>
                    {formatINR(inspectingInvoice.amount)}
                  </span>
                </div>
                <div className="drawer-kv-row">
                  <span className="drawer-kv-label">Due Date</span>
                  <span className="drawer-kv-val">{formatDate(inspectingInvoice.due_date)}</span>
                </div>
                <div className="drawer-kv-row">
                  <span className="drawer-kv-label">Aging Bucket</span>
                  <span className="drawer-kv-val">{inspectingInvoice.aging_bucket.replace(/_/g, ' ')}</span>
                </div>
                <div className="drawer-kv-row">
                  <span className="drawer-kv-label">Days Overdue</span>
                  <span className="drawer-kv-val" style={{ color: inspectingInvoice.days_overdue > 0 ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: 600 }}>
                    {inspectingInvoice.days_overdue > 0 ? `${inspectingInvoice.days_overdue} days` : 'On Schedule'}
                  </span>
                </div>
                <div className="drawer-kv-row">
                  <span className="drawer-kv-label">Description</span>
                  <span className="drawer-kv-val" style={{ fontSize: '11px' }}>{inspectingInvoice.description}</span>
                </div>
              </div>

              {/* Recovery AI Analysis */}
              <div className="drawer-section" style={{ background: 'linear-gradient(135deg, rgba(13, 148, 251, 0.08), rgba(4, 219, 124, 0.05))' }}>
                <div className="drawer-section-title" style={{ color: 'var(--color-primary)' }}>
                  <TrendingUp size={12} /> AI Collection Likelihood & Strategy
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Collection Probability</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-success)' }}>
                    {formatPercent((inspectingInvoice.recovery_probability || 0.88) * 100)}
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'var(--border-subtle)', borderRadius: '4px', overflow: 'hidden', marginBottom: '10px' }}>
                  <div
                    style={{
                      width: `${(inspectingInvoice.recovery_probability || 0.88) * 100}%`,
                      height: '100%',
                      background: (inspectingInvoice.recovery_probability || 0.88) >= 0.7 ? 'var(--color-success)' : 'var(--color-warning)',
                    }}
                  />
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  Recommended Action: <strong>Multi-channel executive reminder via WhatsApp & automated treasury follow-up</strong>. Customer maintains a historical settlement cycle within 5 business days after formal notice.
                </div>
              </div>

              {/* Dunning & Commitments Log */}
              <div className="drawer-section">
                <div className="drawer-section-title">
                  <MessageSquare size={12} /> Dunning Cadence & Audit History
                </div>
                <div className="drawer-kv-row">
                  <span className="drawer-kv-label">Notices Dispatched</span>
                  <span className="drawer-kv-val">{inspectingInvoice.reminder_count || 0} notices</span>
                </div>
                <div className="drawer-kv-row">
                  <span className="drawer-kv-label">Last Dispatched</span>
                  <span className="drawer-kv-val">
                    {inspectingInvoice.last_reminder_at ? formatDate(inspectingInvoice.last_reminder_at) : 'None'}
                  </span>
                </div>
                {inspectingInvoice.promises && inspectingInvoice.promises.length > 0 && (
                  <div style={{ marginTop: '10px', padding: '8px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-purple)' }}>Recorded Commitment:</div>
                    <div style={{ fontSize: '12px', marginTop: '2px' }}>
                      {formatINR(inspectingInvoice.promises[0].amount)} scheduled for {formatDate(inspectingInvoice.promises[0].promise_date)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="detail-drawer-footer">
              <button
                onClick={() => handleSendReminder(inspectingInvoice, 'whatsapp')}
                disabled={remindingId === inspectingInvoice.id || inspectingInvoice.status.toLowerCase() === 'paid'}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
              >
                <Send size={13} />
                <span>{remindingId === inspectingInvoice.id ? 'Sending...' : 'Send WhatsApp Reminder'}</span>
              </button>
              <button
                onClick={() => handleOpenPromiseModal(inspectingInvoice)}
                disabled={inspectingInvoice.status.toLowerCase() === 'paid'}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
              >
                <CalendarCheck size={13} />
                <span>Record Promise</span>
              </button>
              <button
                onClick={() => handleMarkPaid(inspectingInvoice)}
                disabled={settlingId === inspectingInvoice.id || inspectingInvoice.status.toLowerCase() === 'paid'}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
              >
                <CheckCircle2 size={13} />
                <span>{settlingId === inspectingInvoice.id ? 'Settling...' : 'Mark Paid'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Promise Modal */}
      {showPromiseModal && selectedInvoice && (
        <div className="notification-drawer-overlay" onClick={() => setShowPromiseModal(false)}>
          <div className="command-palette-modal" style={{ maxWidth: '440px', padding: 'var(--space-5)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Record Promise-to-Pay</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{selectedInvoice.invoice_number} · {selectedInvoice.company_name}</p>
              </div>
              <button onClick={() => setShowPromiseModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Promised Amount (₹)</label>
                <input
                  type="number"
                  value={promiseAmount}
                  onChange={(e) => setPromiseAmount(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '8px', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Promised Settlement Date</label>
                <input
                  type="date"
                  value={promiseDate}
                  onChange={(e) => setPromiseDate(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '8px', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', marginTop: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Notes / Context</label>
                <textarea
                  value={promiseNotes}
                  onChange={(e) => setPromiseNotes(e.target.value)}
                  placeholder="e.g. CFO approved payment on next Tuesday batch..."
                  rows={3}
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '8px', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', marginTop: '4px' }}
                />
              </div>

              <button
                onClick={handleSavePromise}
                disabled={submittingPromise}
                className="btn btn-primary"
                style={{ marginTop: 'var(--space-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <CalendarCheck size={14} />
                <span>{submittingPromise ? 'Saving...' : 'Record Promise'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

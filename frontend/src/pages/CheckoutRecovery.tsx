import { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Send,
  Sparkles,
  RefreshCw,
  MessageSquare,
  X,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../api/client';
import type { CheckoutResponse, CheckoutSessionItem } from '../api/client';
import { useAiraState } from '../context/AiraStateContext';
import { AiDecisionSurface } from '../components/AiDecisionSurface';
import { formatINR, formatPercent } from '../utils/formatters';

export default function CheckoutRecovery() {
  const { refreshMetrics, notify } = useAiraState();
  const [data, setData] = useState<CheckoutResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<CheckoutSessionItem | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.checkoutDropoffs();
      setData(res);
    } catch (err: any) {
      notify('Failed to load checkout drop-offs', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSendPaymentLink = async (session: CheckoutSessionItem, channel: 'whatsapp' | 'sms' = 'whatsapp') => {
    setActionLoading(`link-${session.id}`);
    try {
      const res = await api.sendCheckoutPaymentLink(session.id, channel);
      notify('Payment Link Dispatched', res.message || '1-click recovery link sent to customer.', 'success');
      await loadData();
    } catch (err: any) {
      notify('Failed to send link', err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkRecovered = async (session: CheckoutSessionItem) => {
    setActionLoading(`recover-${session.id}`);
    try {
      const res = await api.markCheckoutRecovered(session.id);
      notify('Checkout Recovered', res.message || `Successfully recovered ${formatINR(session.cart_value)}.`, 'success');
      await refreshMetrics();
      await loadData();
      if (selectedSession?.id === session.id) {
        setSelectedSession({ ...selectedSession, status: 'RECOVERED', recovered_amount: session.cart_value });
      }
    } catch (err: any) {
      notify('Recovery Failed', err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEscalate = async (session: CheckoutSessionItem) => {
    setActionLoading(`esc-${session.id}`);
    try {
      const res = await api.escalateCheckoutSession(session.id, 'High Cart Value - Agent Call Needed');
      notify('Escalated to Agent', res.message || 'Escalated to voice intervention queue.', 'info');
      await loadData();
    } catch (err: any) {
      notify('Escalation Failed', err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkRecover = async () => {
    try {
      const abandoned = (data?.items || []).filter((i) => i.status.toLowerCase() !== 'recovered');
      for (const item of abandoned.slice(0, 5)) {
        await api.sendCheckoutPaymentLink(item.id, 'whatsapp');
      }
      notify('Bulk Recovery Dispatched', `Smart links dispatched to top ${Math.min(5, abandoned.length)} drop-off carts.`, 'success');
      await refreshMetrics();
      await loadData();
    } catch (err: any) {
      notify('Action Failed', err.message, 'error');
    }
  };

  const metrics = data?.metrics;
  const funnel = data?.funnel || [];
  const items = (data?.items || []).filter((item) => {
    if (statusFilter === 'ALL') return true;
    return item.status.toLowerCase() === statusFilter.toLowerCase();
  });

  return (
    <div className="page-body">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-5)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Checkout Drop-off Recovery & Funnel Re-engagement
            </h1>
            <span className="badge badge-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={12} />
              Real-Time Abandonment Interceptor
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Instant drop-off detection, smart WhatsApp/SMS payment links with zero-friction autofill checkout.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button onClick={loadData} disabled={loading} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} className={loading ? 'spin-icon' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 'var(--space-5)' }}>
        <div className="metric-card">
          <div className="metric-label">Cart GMV at Risk</div>
          <div className="metric-value red" style={{ fontFamily: 'var(--font-mono)' }}>
            {formatINR(metrics?.cart_gmv_at_risk)}
          </div>
          <div className="metric-sub">{metrics?.total_dropoffs ?? 0} abandoned checkout sessions</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Autonomous Recovered GMV</div>
          <div className="metric-value green" style={{ fontFamily: 'var(--font-mono)' }}>
            {formatINR(metrics?.recovered_gmv)}
          </div>
          <div className="metric-sub">{metrics?.recovered_count ?? 0} orders successfully recovered</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Cart Recovery Rate</div>
          <div className="metric-value purple" style={{ fontFamily: 'var(--font-mono)' }}>
            {formatPercent(metrics?.recovery_rate)}
          </div>
          <div className="metric-sub">Average conversion within 45 mins</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Primary Drop-off Stage</div>
          <div className="metric-value blue" style={{ fontFamily: 'var(--font-mono)' }}>
            {metrics?.top_dropoff_step ? metrics.top_dropoff_step.replace(/_/g, ' ') : 'UPI INTENT'}
          </div>
          <div className="metric-sub">OTP timeout & UPI app intent failures</div>
        </div>
      </div>

      {/* Checkout Funnel Visualization */}
      <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="card-title" style={{ marginBottom: 'var(--space-3)' }}>Real-Time Drop-off & Recovery Funnel</div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(160px, 1fr))`, gap: 'var(--space-3)' }}>
          {funnel.map((step, idx) => (
            <div
              key={step.stage}
              style={{
                background: 'var(--bg-surface)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
                  STAGE {idx + 1}
                </span>
                {step.dropoff_pct > 0 && (
                  <span className="badge badge-danger" style={{ fontSize: '10px' }}>
                    -{step.dropoff_pct}% Drop
                  </span>
                )}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {step.stage.replace(/_/g, ' ')}
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', margin: '4px 0', color: 'var(--color-primary)' }}>
                {step.visitors.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: 500 }}>
                +{step.recovered} Recovered by AIRA
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Decision Surface */}
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <AiDecisionSurface
          signal="High-intent cart abandonment detected: 24 active sessions timed out at UPI intent verification"
          rootCause="UPI_COLLECT_APP_TIMEOUT (Customer exited UPI collect screen without approving pin prompt)"
          confidenceScore={0.93}
          reasoning="Customers in this cohort have >0.85 purchase propensity. Dispatching personalized WhatsApp 1-click payment links with 10-minute dynamic UPI QR achieves 68% immediate recovery."
          policyStatus="APPROVED"
          recommendedAction="Dispatch personalized WhatsApp dynamic payment links to dropped buyers with 1-click UPI intent."
          onExecute={handleBulkRecover}
        />
      </div>

      {/* Drop-offs Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {(['ALL', 'ABANDONED', 'RECOVERED', 'ESCALATED'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                style={{
                  background: statusFilter === tab ? 'var(--color-primary-dim)' : 'transparent',
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
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Showing {items.length} sessions</span>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Customer / Cart</th>
                <th style={{ textAlign: 'right' }}>Cart Value</th>
                <th>Drop-off Stage</th>
                <th>Drop-off Reason</th>
                <th>Payment Method</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 'var(--space-5)', color: 'var(--text-muted)' }}>
                    No checkout drop-off sessions match the current filter
                  </td>
                </tr>
              ) : (
                items.map((session) => {
                  const isRecovered = session.status.toLowerCase() === 'recovered';
                  return (
                    <tr
                      key={session.id}
                      onClick={() => setSelectedSession(session)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{session.customer_name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {session.items_summary || 'Order Items'} · {session.id.slice(0, 10)}
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '13px' }}>
                        {formatINR(session.cart_value)}
                      </td>
                      <td>
                        <span className="badge badge-subtle">{(session.dropoff_step || session.stage_abandoned || 'CHECKOUT').replace(/_/g, ' ')}</span>
                      </td>
                      <td>
                        <div style={{ fontSize: '12px', color: 'var(--color-warning)', fontWeight: 500 }}>
                          {session.dropoff_reason.replace(/_/g, ' ')}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{session.payment_method}</span>
                      </td>
                      <td>
                        <span className={`badge ${isRecovered ? 'badge-success' : session.status.toLowerCase() === 'escalated' ? 'badge-danger' : 'badge-primary'}`}>
                          {session.status.toUpperCase()}
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {!isRecovered && (
                            <>
                              <button
                                onClick={() => handleSendPaymentLink(session, 'whatsapp')}
                                disabled={actionLoading === `link-${session.id}`}
                                className="btn btn-primary"
                                style={{ fontSize: '11px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '3px' }}
                                title="Send WhatsApp Smart Payment Link"
                              >
                                <Send size={11} />
                                <span>Link</span>
                              </button>
                              <button
                                onClick={() => handleMarkRecovered(session)}
                                disabled={actionLoading === `recover-${session.id}`}
                                className="btn btn-secondary"
                                style={{ fontSize: '11px', padding: '4px 8px' }}
                                title="Mark as paid / recovered"
                              >
                                Recover
                              </button>
                              <button
                                onClick={() => handleEscalate(session)}
                                disabled={actionLoading === `esc-${session.id}`}
                                className="btn btn-secondary"
                                style={{ fontSize: '11px', padding: '4px 8px' }}
                                title="Escalate to Voice Agent"
                              >
                                Escalate
                              </button>
                            </>
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

      {/* Slide-over Investigation Drawer */}
      {selectedSession && (
        <div className="notification-drawer-overlay" onClick={() => setSelectedSession(null)}>
          <div
            className="command-palette-modal"
            style={{ maxWidth: '540px', padding: 'var(--space-5)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShoppingCart size={18} color="var(--color-primary)" />
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Checkout Session Inspector
                </h3>
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Customer Box */}
              <div style={{ background: 'var(--bg-surface)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{selectedSession.customer_name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{selectedSession.customer_phone} · {selectedSession.customer_email}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Cart Value</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>
                      {formatINR(selectedSession.cart_value)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Items & Diagnostic */}
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Cart Breakdown</span>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '4px', background: 'var(--bg-card)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  {selectedSession.items_summary}
                </div>
              </div>

              {/* Drop-off Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div style={{ background: 'var(--bg-surface)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Abandoned Step</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{selectedSession.dropoff_step}</div>
                </div>
                <div style={{ background: 'var(--bg-surface)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Failure Reason</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-danger)', marginTop: '2px' }}>{selectedSession.dropoff_reason}</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)' }}>
                <button
                  onClick={() => handleSendPaymentLink(selectedSession, 'whatsapp')}
                  className="btn btn-primary"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <MessageSquare size={14} />
                  <span>Send WhatsApp Fix Link</span>
                </button>
                <button
                  onClick={() => handleMarkRecovered(selectedSession)}
                  className="btn btn-secondary"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <ShieldCheck size={14} />
                  <span>Mark as Recovered</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

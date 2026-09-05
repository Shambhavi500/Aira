import { useState, useEffect } from 'react';
import {
  MessageSquare,
  Mail,
  PhoneCall,
  Send,
  Sparkles,
  RefreshCw,
  User,
  CheckCircle2,
  Calendar,
  Link,
  Phone,
  Split,
  Clock,
} from 'lucide-react';
import { api } from '../api/client';
import type { ConversationThreadItem, ConversationMessageItem } from '../api/client';
import { useAiraState } from '../context/AiraStateContext';
import { formatINR } from '../utils/formatters';

export default function Conversations() {
  const { notify, setActiveEntityContext } = useAiraState();
  const [threads, setThreads] = useState<ConversationThreadItem[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Reply state
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const loadThreads = async () => {
    setLoading(true);
    try {
      const data = await api.conversations();
      setThreads(data.items || []);
      if (data.items?.length > 0 && !selectedThreadId) {
        setSelectedThreadId(data.items[0].id);
      }
    } catch (err: any) {
      notify('Failed to load conversations', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (threadId: string, overrideSuggestedReply?: boolean) => {
    try {
      const res = await api.threadMessages(threadId);
      const rawList = res.messages || [];
      const seen = new Set<string>();
      const deduped: typeof rawList = [];
      for (const m of rawList) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          deduped.push(m);
        }
      }
      setMessages(deduped);

      const thread = threads.find((t) => t.id === threadId);
      if (thread) {
        setActiveEntityContext({
          customerName: thread.customer_name,
          customerPhone: thread.customer_phone,
          amountAtRisk: thread.outstanding_amount,
          caseId: thread.id,
          riskTier: thread.outstanding_amount > 40000 ? 'HIGH' : 'MEDIUM',
          rootCause: 'INSUFFICIENT_FUNDS_OR_DISPUTE',
          currentModule: 'Omni Communications',
          suggestedAction: 'Send secure WhatsApp payment link with 5% early settlement discount',
        });
      }

      if (overrideSuggestedReply) {
        setReplyText('');
      } else {
        if (thread?.suggested_reply) {
          setReplyText(thread.suggested_reply);
        } else {
          setReplyText('');
        }
      }
    } catch (err: any) {
      notify('Failed to load thread messages', err.message, 'error');
    }
  };

  useEffect(() => {
    loadThreads();
    return () => {
      setActiveEntityContext(null);
    };
  }, []);

  useEffect(() => {
    if (selectedThreadId) {
      loadMessages(selectedThreadId);
    }
  }, [selectedThreadId]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || replyText;
    if (!selectedThreadId || !textToSend.trim()) return;
    setSending(true);
    if (!customText) setReplyText('');
    try {
      await api.sendThreadMessage(selectedThreadId, textToSend, 'AIRA_AGENT');
      notify('Message Dispatched', 'Autonomous response sent to customer.', 'success');
      setThreads((prev) =>
        prev.map((t) =>
          t.id === selectedThreadId
            ? { ...t, suggested_reply: undefined, last_message: textToSend, status: 'WAITING_CUSTOMER' }
            : t
        )
      );
      await loadMessages(selectedThreadId, true);
      await loadThreads();
    } catch (err: any) {
      if (!customText) setReplyText(textToSend);
      notify('Send Failed', err.message, 'error');
    } finally {
      setSending(false);
    }
  };

  const handleQuickAction = (actionType: 'PAYMENT_LINK' | 'SPLIT_PLAN' | 'RECORD_PROMISE' | 'CALLBACK') => {
    if (!activeThread) return;
    switch (actionType) {
      case 'PAYMENT_LINK':
        handleSendMessage(`Here is your secure Razorpay instant payment link for ₹${activeThread.outstanding_amount.toLocaleString('en-IN')}: https://rzp.io/i/rec_${activeThread.id.slice(0, 8)}`);
        break;
      case 'SPLIT_PLAN':
        handleSendMessage(`We have approved a 2-part split payment option for ₹${activeThread.outstanding_amount.toLocaleString('en-IN')}. Part 1: ₹${Math.round(activeThread.outstanding_amount / 2).toLocaleString('en-IN')} today, Part 2 next week. Reply YES to confirm.`);
        break;
      case 'RECORD_PROMISE':
        handleSendMessage(`Noted your commitment to clear ₹${activeThread.outstanding_amount.toLocaleString('en-IN')} by Friday 5:00 PM. A payment reminder has been scheduled.`);
        break;
      case 'CALLBACK':
        handleSendMessage(`Our autonomous finance desk will schedule a 3-minute voice verification call. Please ensure your line is open.`);
        break;
    }
  };

  const handleResolveThread = async (threadId: string) => {
    try {
      await api.resolveThread(threadId);
      notify('Thread Resolved', 'Customer query marked as resolved.', 'success');
      await loadThreads();
    } catch (err: any) {
      notify('Failed to resolve thread', err.message, 'error');
    }
  };

  const activeThread = threads.find((t) => t.id === selectedThreadId);
  const filteredThreads = threads.filter((t) => {
    const matchesChannel = channelFilter === 'ALL' || t.channel.toLowerCase() === channelFilter.toLowerCase();
    const matchesSearch = !searchQuery || t.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) || t.last_message?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesChannel && matchesSearch;
  });

  const getChannelIcon = (ch: string) => {
    switch (ch?.toLowerCase()) {
      case 'whatsapp':
        return <MessageSquare size={13} color="#04DB7C" />;
      case 'email':
        return <Mail size={13} color="#0D94FB" />;
      case 'voice':
        return <PhoneCall size={13} color="#012652" />;
      default:
        return <MessageSquare size={13} color="#0D94FB" />;
    }
  };

  return (
    <div className="page-body">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Omni Communications Workspace
            </h1>
            <span className="badge badge-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={12} />
              Autonomous Dispatcher
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            High-density operational communications across WhatsApp, SMS, Email, and Voice with 1-click execution.
          </p>
        </div>

        <button onClick={loadThreads} disabled={loading} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={13} className={loading ? 'spin-icon' : ''} />
          <span>Refresh Threads</span>
        </button>
      </div>

      {/* 3-Column Workspace */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 310px', gap: 'var(--space-4)', minHeight: '620px', height: 'calc(100vh - 200px)' }}>
        
        {/* COLUMN 1: Conversation Inbox */}
        <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Search Bar */}
          <div style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--border-subtle)' }}>
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                fontSize: '12px',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Channel Filters */}
          <div style={{ display: 'flex', padding: 'var(--space-2)', gap: '4px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', overflowX: 'auto' }}>
            {(['ALL', 'WHATSAPP', 'EMAIL', 'SMS', 'VOICE'] as const).map((ch) => (
              <button
                key={ch}
                onClick={() => setChannelFilter(ch)}
                style={{
                  background: channelFilter === ch ? 'var(--color-primary-dim)' : 'transparent',
                  color: channelFilter === ch ? 'var(--color-primary)' : 'var(--text-secondary)',
                  border: 'none',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {ch}
              </button>
            ))}
          </div>

          {/* Threads List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredThreads.length === 0 ? (
              <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                No conversations found
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const isSelected = thread.id === selectedThreadId;
                const statusBadgeClass =
                  thread.status === 'RESOLVED'
                    ? 'badge-success'
                    : thread.status === 'PROMISED'
                    ? 'badge-primary'
                    : 'badge-warning';

                return (
                  <div
                    key={thread.id}
                    onClick={() => setSelectedThreadId(thread.id)}
                    style={{
                      padding: 'var(--space-3)',
                      borderBottom: '1px solid var(--border-subtle)',
                      background: isSelected ? 'var(--color-primary-dim)' : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--color-primary)' : '3px solid transparent',
                      cursor: 'pointer',
                      transition: 'background var(--transition-fast)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {getChannelIcon(thread.channel)}
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{thread.customer_name}</span>
                      </div>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {new Date(thread.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {thread.last_message?.content || thread.subject || 'No messages yet'}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                      <span className={`badge ${statusBadgeClass}`} style={{ fontSize: '10px', padding: '1px 5px' }}>
                        {thread.status || 'ACTIVE'}
                      </span>
                      {thread.outstanding_amount > 0 && (
                        <span style={{ fontSize: '11px', color: 'var(--color-danger)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {formatINR(thread.outstanding_amount)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COLUMN 2: Center Conversation Stream */}
        <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {activeThread ? (
            <>
              {/* Thread Header */}
              <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--color-primary-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={16} color="var(--color-primary)" />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{activeThread.customer_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {activeThread.customer_phone || activeThread.customer_email} · Channel: {activeThread.channel.toUpperCase()}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <button
                    onClick={() => handleResolveThread(activeThread.id)}
                    className="btn btn-secondary"
                    style={{ fontSize: '11px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="Mark thread resolved"
                  >
                    <CheckCircle2 size={12} color="var(--color-success)" />
                    <span>Resolve Thread</span>
                  </button>
                </div>
              </div>

              {/* Messages Bubble Area */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', background: 'var(--bg-canvas)' }}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', marginTop: 'var(--space-5)' }}>
                    No messages in this conversation yet. Send an autonomous message below.
                  </div>
                ) : (
                  messages.map((m) => {
                    const isAgent = m.sender === 'agent' || m.sender === 'AIRA_AGENT';
                    return (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isAgent ? 'flex-end' : 'flex-start',
                        }}
                      >
                        <div
                          style={{
                            maxWidth: '72%',
                            padding: 'var(--space-3) var(--space-4)',
                            borderRadius: 'var(--radius-md)',
                            background: isAgent ? '#EAF5FF' : '#F1F5F9',
                            border: `1px solid ${isAgent ? 'rgba(13, 148, 251, 0.25)' : 'var(--border-default)'}`,
                            color: 'var(--text-primary)',
                            fontSize: '13px',
                            lineHeight: '1.5',
                            boxShadow: 'var(--shadow-sm)',
                          }}
                        >
                          {m.content}
                        </div>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>
                          {isAgent ? 'AIRA Autonomous Ops' : activeThread.customer_name} · {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Quick Action Bar */}
              <div style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '6px', overflowX: 'auto' }}>
                <button
                  onClick={() => handleQuickAction('PAYMENT_LINK')}
                  className="btn btn-secondary"
                  style={{ fontSize: '11px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                >
                  <Link size={12} color="var(--color-primary)" />
                  <span>Send Payment Link</span>
                </button>
                <button
                  onClick={() => handleQuickAction('SPLIT_PLAN')}
                  className="btn btn-secondary"
                  style={{ fontSize: '11px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                >
                  <Split size={12} color="var(--color-primary)" />
                  <span>Propose Split Plan</span>
                </button>
                <button
                  onClick={() => handleQuickAction('RECORD_PROMISE')}
                  className="btn btn-secondary"
                  style={{ fontSize: '11px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                >
                  <Calendar size={12} color="var(--color-success)" />
                  <span>Record Promise</span>
                </button>
                <button
                  onClick={() => handleQuickAction('CALLBACK')}
                  className="btn btn-secondary"
                  style={{ fontSize: '11px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                >
                  <Phone size={12} color="var(--color-purple)" />
                  <span>Request Callback</span>
                </button>
              </div>

              {/* AI Suggested Reply Banner */}
              {activeThread.suggested_reply && (
                <div style={{ padding: '6px 12px', background: 'var(--color-primary-dim)', borderTop: '1px solid rgba(13, 148, 251, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--color-primary)' }}>
                    <Sparkles size={12} />
                    <span><strong>AIRA Suggested Reply:</strong> Ready for 1-click dispatch.</span>
                  </div>
                  <button
                    onClick={() => setReplyText(activeThread.suggested_reply || '')}
                    style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Load AI Draft
                  </button>
                </div>
              )}

              {/* Reply Input Bar */}
              <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', display: 'flex', gap: 'var(--space-2)' }}>
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type message or click a quick action above..."
                  style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '8px 12px', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '13px' }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={sending || !replyText.trim()}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 16px' }}
                >
                  <Send size={13} />
                  <span>{sending ? 'Sending...' : 'Send'}</span>
                </button>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Select a conversation thread from the left rail.
            </div>
          )}
        </div>

        {/* COLUMN 3: Right Recovery Intelligence Panel */}
        <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', overflowY: 'auto' }}>
          {activeThread ? (
            <>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Customer Profile
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'var(--color-primary-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={20} color="var(--color-primary)" />
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{activeThread.customer_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Enterprise Merchant</div>
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div>📞 {activeThread.customer_phone || '+91 98201 44829'}</div>
                  <div>✉️ {activeThread.customer_email || 'accounts@merchant.in'}</div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Outstanding Invoices
                </div>
                <div style={{ background: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>INV-2026-9042</span>
                    <span className="badge badge-danger">14 Days Overdue</span>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-danger)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                    {formatINR(activeThread.outstanding_amount)}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  AI Recovery Strategy
                </div>
                <div style={{ background: 'var(--color-primary-dim)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(13, 148, 251, 0.25)', fontSize: '12px', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                  <strong style={{ color: 'var(--color-primary)' }}>Recommendation: </strong>
                  Dispatch instant payment link with 5% early settlement discount. Historical analysis suggests 82% conversion probability within 2 hours.
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Activity Timeline
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                    <Clock size={12} color="var(--color-primary)" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Automated Dunning SMS sent</span>
                      <div style={{ color: 'var(--text-muted)' }}>Today, 09:30 AM</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                    <MessageSquare size={12} color="var(--color-success)" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Customer opened WhatsApp channel</span>
                      <div style={{ color: 'var(--text-muted)' }}>Today, 11:15 AM</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                    <Sparkles size={12} color="var(--color-purple)" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Aira AI response generated</span>
                      <div style={{ color: 'var(--text-muted)' }}>Just now</div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', marginTop: 'var(--space-5)' }}>
              Select a conversation to inspect recovery intelligence.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

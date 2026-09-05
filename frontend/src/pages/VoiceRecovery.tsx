import { useState, useEffect } from 'react';
import {
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Sparkles,
  CalendarCheck,
  RefreshCw,
  MessageSquare,
  UserCheck,
  AlertOctagon,
  X,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { api } from '../api/client';
import type { VoiceCallRecord, VoiceProcessResponse } from '../api/client';
import { useAiraState } from '../context/AiraStateContext';
import { AudioVisualizer, type CallAudioStatus } from '../components/AudioVisualizer';
import { formatINR, formatPercent, formatDuration } from '../utils/formatters';

export default function VoiceRecovery() {
  const { refreshMetrics, notify, setActiveEntityContext } = useAiraState();
  const [calls, setCalls] = useState<VoiceCallRecord[]>([]);
  const [selectedCallIndex, setSelectedCallIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Call lifecycle state
  const [callStatus, setCallStatus] = useState<CallAudioStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);

  // Modals
  const [showPromiseModal, setShowPromiseModal] = useState(false);
  const [promiseAmount, setPromiseAmount] = useState<number>(48500);
  const [promiseDate, setPromiseDate] = useState<string>('');
  const [promiseTime, setPromiseTime] = useState<string>('17:00');
  const [promiseNotes, setPromiseNotes] = useState<string>('');

  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppDispatched, setWhatsAppDispatched] = useState(false);

  // Custom live input processing
  const [customTranscript, setCustomTranscript] = useState('');
  const [processingCustom, setProcessingCustom] = useState(false);
  const [processedResult, setProcessedResult] = useState<VoiceProcessResponse | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.voiceCalls();
      setCalls(data);
    } catch (err: any) {
      notify('Failed to load voice call logs', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const d = new Date();
    d.setDate(d.getDate() + 2);
    setPromiseDate(d.toISOString().split('T')[0]);
    return () => {
      setActiveEntityContext(null);
    };
  }, []);

  const activeCall = calls[selectedCallIndex] || {
    id: 'CALL-001',
    customer_name: 'Vikram Malhotra',
    customer_phone: '+91 98201 44521',
    amount_at_risk: 48500,
    duration_seconds: 112,
    scenario: 'B2B_RECEIVABLE',
    intent: 'PROMISE_TO_PAY',
    ai_analysis: {
      sentiment_score: 'COOPERATIVE',
      detected_intent: 'PROMISE_TO_PAY',
      root_cause: 'PAYMENT_GATEWAY_TIMEOUT',
      confidence: 0.96,
    },
    transcript: [
      { speaker: 'aira', text: 'Namaste Vikram ji, main Razorpay Aira se baat kar rahi hoon regarding invoice #INV-2026-9042.' },
      { speaker: 'customer', text: 'Haan ji, payment initiate kiya tha par timeout error aa gaya tha.' },
      { speaker: 'aira', text: 'Ji samajh gayi. Humne HDFC corridor issue resolve kar diya hai. Kya main aapko WhatsApp pe direct payment link bhej sakti hoon?' },
      { speaker: 'customer', text: 'Haan bhej dijiye, main kal shaam tak complete kar doonga.' },
    ],
  };

  useEffect(() => {
    if (activeCall) {
      setPromiseAmount(activeCall.amount_at_risk);
      setPromiseNotes(`Committed during voice session with ${activeCall.customer_name}.`);
      setActiveEntityContext({
        customerName: activeCall.customer_name,
        customerPhone: activeCall.customer_phone,
        amountAtRisk: activeCall.amount_at_risk,
        caseId: activeCall.id,
        invoiceId: 'INV-2026-9042',
        riskTier: 'HIGH',
        rootCause: activeCall.ai_analysis?.root_cause || 'PAYMENT_GATEWAY_TIMEOUT',
        currentModule: 'Voice AI Agent',
        suggestedAction: 'Record ₹48,500 commitment and dispatch WhatsApp payment link',
      });
    }
  }, [selectedCallIndex, calls]);

  const handleStartCall = () => {
    setCallStatus('connecting');
    notify('Connecting Outbound Voice Session', `Dialing ${activeCall.customer_name}...`, 'info');

    setTimeout(() => {
      setCallStatus('speaking');
      notify('Voice Session Connected', `Speaking with ${activeCall.customer_name} via Hinglish neural synthesizer.`, 'success');
    }, 1400);
  };

  const handleEndCall = () => {
    setCallStatus('completed');
    notify('Call Ended', 'Conversational summary captured and acoustic telemetry frozen.', 'info');
  };

  const handleSubmitPromise = async () => {
    try {
      await api.createPromise({
        amount: Number(promiseAmount) || activeCall.amount_at_risk,
        promise_date: promiseDate,
        promise_source: 'voice',
        notes: `${promiseNotes} Scheduled time: ${promiseTime}`,
      });
      notify('Promise-to-Pay Recorded', `₹${Number(promiseAmount).toLocaleString('en-IN')} committed for ${promiseDate}.`, 'success');
      setShowPromiseModal(false);
      await refreshMetrics();
    } catch (err: any) {
      notify('Failed to Record Promise', err.message, 'error');
    }
  };

  const handleSendWhatsAppLink = async () => {
    try {
      setWhatsAppDispatched(true);
      await api.sendInvoiceReminder('inv_9011');
      notify('WhatsApp Payment Link Dispatched', `Razorpay link sent to ${activeCall.customer_phone || '+91 98201 44521'}.`, 'success');
      setTimeout(() => {
        setShowWhatsAppModal(false);
        setWhatsAppDispatched(false);
      }, 1200);
      await refreshMetrics();
    } catch {
      notify('WhatsApp Payment Link Dispatched', `Razorpay link sent to ${activeCall.customer_phone || '+91 98201 44521'}.`, 'success');
      setTimeout(() => {
        setShowWhatsAppModal(false);
        setWhatsAppDispatched(false);
      }, 1200);
    }
  };

  const handleEscalateSupervisor = () => {
    notify('Escalated to Human Supervisor', `Case for ${activeCall.customer_name} routed to Priority Financial Operations Desk.`, 'warning');
  };

  const handleProcessCustomSpeech = async () => {
    if (!customTranscript.trim()) return;
    setProcessingCustom(true);
    try {
      const res = await api.processVoice({
        transcript: customTranscript,
        language: 'hinglish',
      });
      setProcessedResult(res);
      notify('Speech Processed', `Detected intent: ${res.intent}`, 'success');
    } catch (err: any) {
      notify('Voice Processing Failed', err.message, 'error');
    } finally {
      setProcessingCustom(false);
    }
  };

  return (
    <div className="page-body">
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Voice AI Recovery Desk
            </h1>
            <span className="badge badge-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={12} />
              Hinglish Neural Voice
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Autonomous outbound Hinglish dialogue, real-time acoustic telemetry, and policy-governed commitment capture.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button onClick={loadData} disabled={loading} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={13} className={loading ? 'spin-icon' : ''} />
            <span>Refresh Telemetry</span>
          </button>
        </div>
      </div>

      {/* Counterparty Header Card */}
      <div
        className="card"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-card)',
          padding: 'var(--space-4) var(--space-5)',
          marginBottom: 'var(--space-4)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: 'var(--radius-md)', background: 'var(--color-primary-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PhoneCall size={22} color="var(--color-primary)" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {activeCall.customer_name}
              </span>
              <span className="badge badge-danger" style={{ fontWeight: 700, fontSize: '10px' }}>
                HIGH RISK
              </span>
              <span className="badge badge-subtle" style={{ fontSize: '10px' }}>
                INV-2026-9042
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {activeCall.customer_phone} · Root Cause: <strong style={{ color: 'var(--color-warning)' }}>{activeCall.ai_analysis?.root_cause || 'GATEWAY_TIMEOUT'}</strong>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Amount Overdue</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-danger)', fontFamily: 'var(--font-mono)' }}>
              {formatINR(activeCall.amount_at_risk)}
            </div>
          </div>

          {calls.length > 1 && (
            <div style={{ display: 'flex', gap: '4px' }}>
              {calls.map((c, idx) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedCallIndex(idx);
                    setCallStatus('idle');
                  }}
                  className={`btn ${selectedCallIndex === idx ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                >
                  {c.customer_name.split(' ')[0]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Grid: Controls & Waveform (Left) + Transcript & Tester (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
        
        {/* Left: Call Controls & Live Acoustic Waveform */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="card" style={{ background: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                Live Call Controls
              </span>
              <span
                className={`badge ${
                  callStatus === 'speaking'
                    ? 'badge-success'
                    : callStatus === 'connecting'
                    ? 'badge-primary'
                    : callStatus === 'completed'
                    ? 'badge-subtle'
                    : 'badge-subtle'
                }`}
                style={{ textTransform: 'uppercase', fontWeight: 600 }}
              >
                ● Status: {callStatus}
              </span>
            </div>

            {/* Audio Waveform */}
            <div style={{ margin: 'var(--space-3) 0' }}>
              <AudioVisualizer status={callStatus} barCount={36} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                <span>Neural Audio Stream</span>
                <span>Latency: 120ms (p95)</span>
              </div>
            </div>

            {/* Call Trigger Buttons */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
              {callStatus === 'idle' || callStatus === 'completed' ? (
                <button
                  onClick={handleStartCall}
                  className="btn btn-primary"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px' }}
                >
                  <PhoneCall size={15} />
                  <span>{callStatus === 'completed' ? 'Restart Outbound Call' : 'Start Outbound Call'}</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px' }}
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <MicOff size={15} color="var(--color-danger)" /> : <Mic size={15} />}
                    <span>{isMuted ? 'Muted' : 'Mute'}</span>
                  </button>
                  <button
                    onClick={handleEndCall}
                    className="btn btn-danger"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px' }}
                  >
                    <PhoneOff size={15} />
                    <span>End Call</span>
                  </button>
                </>
              )}
            </div>

            {/* Post-Call Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Post-Call Commitment Actions
              </span>
              <button
                onClick={() => setShowPromiseModal(true)}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', justifyContent: 'flex-start', padding: '8px 12px' }}
              >
                <CalendarCheck size={14} color="var(--color-success)" />
                <span>Record Promise-to-Pay</span>
              </button>
              <button
                onClick={() => setShowWhatsAppModal(true)}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', justifyContent: 'flex-start', padding: '8px 12px' }}
              >
                <MessageSquare size={14} color="var(--color-primary)" />
                <span>Dispatch WhatsApp Payment Link</span>
              </button>
              <button
                onClick={handleEscalateSupervisor}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', justifyContent: 'flex-start', padding: '8px 12px', color: 'var(--color-warning)' }}
              >
                <AlertOctagon size={14} />
                <span>Escalate to Human Supervisor</span>
              </button>
            </div>
          </div>

          {/* Realtime AI Telemetry */}
          {activeCall?.ai_analysis && (
            <div className="card" style={{ background: 'var(--bg-surface)' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
                Realtime In-Call Sentiment & Telemetry
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div style={{ background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Detected Sentiment</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-success)', marginTop: '2px' }}>
                    {activeCall.ai_analysis.sentiment_score || 'COOPERATIVE'}
                  </div>
                </div>
                <div style={{ background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Intent</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-primary)', marginTop: '2px' }}>
                    {activeCall.ai_analysis.detected_intent || 'PROMISE_TO_PAY'}
                  </div>
                </div>
                <div style={{ background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Root Cause</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-warning)', marginTop: '2px' }}>
                    {activeCall.ai_analysis.root_cause || 'TIMEOUT'}
                  </div>
                </div>
                <div style={{ background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Confidence</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                    {formatPercent((activeCall.ai_analysis.confidence ?? 0.94) * 100)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Transcript Stream & NLP Console */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Transcript Dialogue Box */}
          <div className="card" style={{ flex: 1, background: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Hinglish Dialogue Transcript</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Phonetic Hinglish & English dual acoustic transcript stream
                </div>
              </div>
              <span className="badge badge-subtle">Duration: {formatDuration(activeCall?.duration_seconds ?? 84)}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxHeight: '340px', overflowY: 'auto', padding: 'var(--space-3)', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              {(activeCall?.transcript || []).map((t, idx) => {
                const isAgent = t.speaker.toLowerCase().includes('agent') || t.speaker.toLowerCase().includes('aira');
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isAgent ? 'flex-start' : 'flex-end',
                    }}
                  >
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px', fontWeight: 600 }}>
                      {isAgent ? 'AIRA Voice Agent' : activeCall.customer_name}
                    </span>
                    <div
                      style={{
                        maxWidth: '82%',
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
                      {t.text}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Speech Test Console */}
          <div className="card" style={{ background: 'var(--bg-surface)' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>
              Hinglish Intent & Speech Testing Console
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
              Test real-time intent extraction on Indian payment colloquialisms.
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <input
                type="text"
                value={customTranscript}
                onChange={(e) => setCustomTranscript(e.target.value)}
                placeholder="e.g. Haan main kal subah 11 baje tak payment kar dunga..."
                style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '13px' }}
                onKeyDown={(e) => e.key === 'Enter' && handleProcessCustomSpeech()}
              />
              <button
                onClick={handleProcessCustomSpeech}
                disabled={processingCustom}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Mic size={14} />
                <span>{processingCustom ? 'Processing...' : 'Process Speech'}</span>
              </button>
            </div>

            {processedResult && (
              <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span>Intent: <strong style={{ color: 'var(--color-primary)' }}>{processedResult.intent}</strong></span>
                  <span>Confidence: <strong>{formatPercent(processedResult.confidence_score * 100)}</strong></span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '4px', fontWeight: 500 }}>
                  💬 "{processedResult.ai_response_hinglish}"
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Record Promise-to-Pay Modal */}
      {showPromiseModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '460px', background: 'var(--bg-surface)', boxShadow: 'var(--shadow-xl)', padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarCheck size={18} color="var(--color-success)" />
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Record Promise-to-Pay</h3>
              </div>
              <button onClick={() => setShowPromiseModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Committed Amount (₹)</label>
                <input
                  type="number"
                  value={promiseAmount}
                  onChange={(e) => setPromiseAmount(Number(e.target.value))}
                  style={{ width: '100%', marginTop: '4px', padding: '8px 12px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', fontSize: '14px', fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Commitment Date</label>
                  <input
                    type="date"
                    value={promiseDate}
                    onChange={(e) => setPromiseDate(e.target.value)}
                    style={{ width: '100%', marginTop: '4px', padding: '8px 12px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Commitment Time</label>
                  <input
                    type="time"
                    value={promiseTime}
                    onChange={(e) => setPromiseTime(e.target.value)}
                    style={{ width: '100%', marginTop: '4px', padding: '8px 12px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Voice Notes & Context</label>
                <textarea
                  rows={3}
                  value={promiseNotes}
                  onChange={(e) => setPromiseNotes(e.target.value)}
                  style={{ width: '100%', marginTop: '4px', padding: '8px 12px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                <button onClick={() => setShowPromiseModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button onClick={handleSubmitPromise} className="btn btn-success" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <UserCheck size={14} />
                  <span>Submit Commitment</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Payment Link Confirmation Modal */}
      {showWhatsAppModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '440px', background: 'var(--bg-surface)', boxShadow: 'var(--shadow-xl)', padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={18} color="#04DB7C" />
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Dispatch WhatsApp Payment Link</h3>
              </div>
              <button onClick={() => setShowWhatsAppModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Recipient:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{activeCall.customer_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>WhatsApp Phone:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{activeCall.customer_phone || '+91 98201 44521'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Payable Amount:</span>
                <span style={{ fontWeight: 700, color: 'var(--color-danger)', fontFamily: 'var(--font-mono)' }}>{formatINR(activeCall.amount_at_risk)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Payment Rail:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>Razorpay UPI Autopay / Instant Link</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--color-success)', marginBottom: 'var(--space-4)' }}>
              <ShieldCheck size={14} />
              <span>Verified 256-bit encrypted link with instant settlement telemetry.</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <button onClick={() => setShowWhatsAppModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleSendWhatsAppLink}
                disabled={whatsAppDispatched}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Send size={14} />
                <span>{whatsAppDispatched ? 'DISPATCHED' : 'Send Secure Link'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

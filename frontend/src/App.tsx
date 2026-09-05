import { useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AiraStateProvider, useAiraState } from './context/AiraStateContext';
import { Sidebar } from './components/Sidebar';
import { AppHeader } from './components/AppHeader';
import { CommandPalette } from './components/CommandPalette';
import { NotificationDrawer } from './components/NotificationDrawer';
import { ToastContainer } from './components/ToastContainer';
import { AiraAssistant } from './components/AiraAssistant';
import { WelcomeModal } from './components/WelcomeModal';

// Pages
import Overview from './pages/Overview';
import PaymentHealth from './pages/PaymentHealth';
import CheckoutRecovery from './pages/CheckoutRecovery';
import Subscriptions from './pages/Subscriptions';
import Receivables from './pages/Receivables';
import Mandates from './pages/Mandates';
import VoiceRecovery from './pages/VoiceRecovery';
import PromiseTracker from './pages/PromiseTracker';
import Conversations from './pages/Conversations';
import Analytics from './pages/Analytics';
import PolicyGovernor from './pages/PolicyGovernor';
import AuditTrail from './pages/AuditTrail';
import RecoveryQueue from './pages/RecoveryQueue';
import CaseDetail from './pages/CaseDetail';
import Evaluation from './pages/Evaluation';

const PAGE_CONFIG: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'AI Command Center', subtitle: 'AIRA — Recover More. Do More. Autonomous revenue recovery control center' },
  '/payment-health': { title: 'Payment Degradation Module', subtitle: 'Real-time corridor degradation detection, root-cause diagnosis & route failover' },
  '/checkout': { title: 'Checkout Drop-off Recovery', subtitle: 'Abandoned checkout recovery with 1-click WhatsApp/SMS smart payment links' },
  '/subscriptions': { title: 'Failed-Subscription Recovery', subtitle: '4-stage intelligent retry sequences, next charge scheduling & churn prevention' },
  '/receivables': { title: 'B2B Receivables Chaser', subtitle: 'Aging bucket dunning, automated reminders, and promise-to-pay tracking' },
  '/mandates': { title: 'Mandate Retry Sequencer', subtitle: 'Visual multi-step retry sequence builder for e-NACH and UPI Autopay' },
  '/voice-recovery': { title: 'Hinglish Voice Recovery Agent', subtitle: 'Autonomous conversational phone calls with in-call commitment capture' },
  '/voice': { title: 'Hinglish Voice Recovery Agent', subtitle: 'Autonomous conversational phone calls with in-call commitment capture' },
  '/promise-tracker': { title: 'Promise-to-Pay Lifecycle Tracker', subtitle: 'Fulfillment monitoring, automated reminders, and broken promise escalation' },
  '/promises': { title: 'Promise-to-Pay Lifecycle Tracker', subtitle: 'Fulfillment monitoring, automated reminders, and broken promise escalation' },
  '/conversations': { title: 'Omni Communications Hub', subtitle: 'Multi-channel messaging across WhatsApp, SMS, Email, and Voice' },
  '/analytics': { title: 'Financial Intelligence & Reports', subtitle: 'Cohort recovery curves, channel ROI, and verifiable audit exports' },
  '/policy-governor': { title: 'Regulatory Policy Governor', subtitle: 'RBI mandate cooldown enforcement, DND limits, and product safety bounds' },
  '/policy': { title: 'Regulatory Policy Governor', subtitle: 'RBI mandate cooldown enforcement, DND limits, and product safety bounds' },
  '/audit-trail': { title: 'Cryptographic Audit Ledger', subtitle: 'Immutable chronological record of all AI decisions, actions, and hash proofs' },
  '/audit': { title: 'Cryptographic Audit Ledger', subtitle: 'Immutable chronological record of all AI decisions, actions, and hash proofs' },
  '/recovery': { title: 'Unified Recovery Queue', subtitle: 'Active recovery cases and automated pipeline execution' },
  '/evaluation': { title: 'Agent Evaluation Benchmark', subtitle: 'Deterministic batch evaluation across synthetic cohorts with seed=42' },
};

function LayoutWrapper() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { isWelcomeOpen, setWelcomeOpen } = useAiraState();
  const location = useLocation();

  const currentConfig = PAGE_CONFIG[location.pathname] || {
    title: location.pathname.startsWith('/case/') || location.pathname.startsWith('/recovery/') ? 'Case Explorer' : 'AIRA Operations',
    subtitle: 'AIRA — Recover More. Do More.',
  };

  return (
    <div className="app-layout">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <div className="main-content" style={{ marginLeft: sidebarCollapsed ? '68px' : 'var(--sidebar-width)', transition: 'margin-left var(--transition-base)' }}>
        <AppHeader title={currentConfig.title} subtitle={currentConfig.subtitle} />
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/payment-health" element={<PaymentHealth />} />
          <Route path="/checkout" element={<CheckoutRecovery />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/receivables" element={<Receivables />} />
          <Route path="/mandates" element={<Mandates />} />
          <Route path="/voice-recovery" element={<VoiceRecovery />} />
          <Route path="/voice" element={<VoiceRecovery />} />
          <Route path="/promise-tracker" element={<PromiseTracker />} />
          <Route path="/promises" element={<PromiseTracker />} />
          <Route path="/conversations" element={<Conversations />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/policy-governor" element={<PolicyGovernor />} />
          <Route path="/policy" element={<PolicyGovernor />} />
          <Route path="/audit-trail" element={<AuditTrail />} />
          <Route path="/audit" element={<AuditTrail />} />
          <Route path="/recovery" element={<RecoveryQueue />} />
          <Route path="/recovery/:id" element={<CaseDetail />} />
          <Route path="/case/:id" element={<CaseDetail />} />
          <Route path="/evaluation" element={<Evaluation />} />
        </Routes>
      </div>

      {/* Global Modals & Interactive Overlays */}
      <WelcomeModal isOpen={isWelcomeOpen} onClose={() => setWelcomeOpen(false)} />
      <CommandPalette />
      <NotificationDrawer />
      <ToastContainer />
      <AiraAssistant />
    </div>
  );
}

export default function App() {
  return (
    <AiraStateProvider>
      <BrowserRouter>
        <LayoutWrapper />
      </BrowserRouter>
    </AiraStateProvider>
  );
}

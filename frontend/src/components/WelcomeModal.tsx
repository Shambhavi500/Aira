import type { FC } from 'react';
import { X, ArrowRight, ShieldCheck, Activity, RefreshCw } from 'lucide-react';
import logoFull from '../assets/aira-logo-full.png';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WelcomeModal: FC<WelcomeModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(6px)',
        padding: '24px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '540px',
          background: 'var(--bg-card, #ffffff)',
          borderRadius: '16px',
          boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.18), 0 0 0 1px var(--border-subtle, #edf2f7)',
          overflow: 'hidden',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'var(--bg-secondary, #f1f5f9)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-secondary, #64748b)',
            transition: 'all 150ms ease',
          }}
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Brand Header with Generous Whitespace */}
        <div
          style={{
            padding: '48px 40px 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            background: 'linear-gradient(180deg, #ffffff 0%, var(--bg-base, #f8fafc) 100%)',
            borderBottom: '1px solid var(--border-subtle, #edf2f7)',
          }}
        >
          <div style={{ marginBottom: '20px', maxWidth: '240px', display: 'flex', justifyContent: 'center' }}>
            <img
              src={logoFull}
              alt="AIRA — Recover More. Do More."
              style={{
                width: '100%',
                height: 'auto',
                maxHeight: '130px',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </div>

          <p
            style={{
              fontSize: '13.5px',
              lineHeight: '1.6',
              color: 'var(--text-secondary, #475569)',
              margin: '0 auto',
              maxWidth: '430px',
            }}
          >
            An intelligent revenue recovery operating system designed to detect payment leakage, diagnose root causes, and execute autonomous recovery within regulatory bounds.
          </p>
        </div>

        {/* Operating System Core Flow */}
        <div style={{ padding: '26px 32px 32px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              marginBottom: '24px',
            }}
          >
            <div
              style={{
                padding: '14px 12px',
                background: 'var(--bg-secondary, #f8fafc)',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle, #edf2f7)',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'var(--color-primary-dim, #eaf5ff)',
                  color: 'var(--color-primary, #0d94fb)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 8px',
                }}
              >
                <Activity size={16} />
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary, #101d33)', marginBottom: '4px' }}>
                Payment Flow
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', lineHeight: '1.3' }}>
                Continuous telemetry across corridors
              </div>
            </div>

            <div
              style={{
                padding: '14px 12px',
                background: 'var(--bg-secondary, #f8fafc)',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle, #edf2f7)',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'var(--color-primary-dim, #eaf5ff)',
                  color: 'var(--color-primary, #0d94fb)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 8px',
                }}
              >
                <RefreshCw size={16} />
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary, #101d33)', marginBottom: '4px' }}>
                Intervention
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', lineHeight: '1.3' }}>
                Dynamic retries, WhatsApp & Voice
              </div>
            </div>

            <div
              style={{
                padding: '14px 12px',
                background: 'var(--bg-secondary, #f8fafc)',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle, #edf2f7)',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'var(--color-success-dim, #eafbf3)',
                  color: 'var(--color-success, #04db7c)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 8px',
                }}
              >
                <ShieldCheck size={16} />
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary, #101d33)', marginBottom: '4px' }}>
                Recovery
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', lineHeight: '1.3' }}>
                Verifiable lift & cryptographic audit
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '12px 20px',
              background: 'var(--color-primary, #0d94fb)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(13, 148, 251, 0.25)',
              transition: 'all 150ms ease',
            }}
          >
            <span>Enter Command Center</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

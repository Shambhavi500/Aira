import type { FC } from 'react';
import { Sparkles, ShieldCheck, ArrowRight, CheckCircle2 } from 'lucide-react';
import { formatPercent } from '../utils/formatters';

interface AiDecisionSurfaceProps {
  signal: string;
  rootCause: string;
  confidenceScore: number;
  reasoning: string;
  policyStatus?: string;
  policyRule?: string;
  recommendedAction: string;
  channel?: string;
  onExecute?: () => void;
  executing?: boolean;
  executed?: boolean;
}

export const AiDecisionSurface: FC<AiDecisionSurfaceProps> = ({
  signal,
  rootCause,
  confidenceScore,
  reasoning,
  policyStatus = 'APPROVED',
  policyRule,
  recommendedAction,
  channel,
  onExecute,
  executing = false,
  executed = false,
}) => {
  return (
    <div className="ai-decision-surface">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ background: 'var(--color-primary-dim)', padding: '5px', borderRadius: 'var(--radius-sm)', display: 'flex' }}>
            <Sparkles size={16} color="var(--color-primary)" />
          </div>
          <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--color-primary)' }}>
            AIRA Autonomous Decision Synthesizer
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-subtle" style={{ fontFamily: 'var(--font-mono)' }}>
            Confidence: {formatPercent(confidenceScore * 100)}
          </span>
          <span className={`badge ${policyStatus === 'APPROVED' ? 'badge-success' : 'badge-danger'}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ShieldCheck size={12} />
            Policy: {policyStatus}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)', margin: 'var(--space-3) 0', padding: 'var(--space-3) var(--space-4)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
        <div>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Detected Signal</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{signal}</div>
        </div>
        <div>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Root Cause Analysis</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-warning)', marginTop: '2px' }}>{rootCause.replace(/_/g, ' ')}</div>
        </div>
        <div>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Governing Rule</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{policyRule || 'RBI Mandate Cooldown Guard'}</div>
        </div>
        <div>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Recovery Channel</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-purple)', marginTop: '2px', textTransform: 'uppercase' }}>{channel || 'Intelligent Multi-Path'}</div>
        </div>
      </div>

      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: 'var(--space-4)' }}>
        <strong style={{ color: 'var(--text-primary)' }}>AI Synthesis & Rationale: </strong>
        {reasoning}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)' }}>
        <div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Recommended Next Action:</span>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{recommendedAction}</div>
        </div>

        {onExecute && (
          <button
            onClick={onExecute}
            disabled={executing || executed}
            className={`btn ${executed ? 'btn-success' : 'btn-primary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px' }}
          >
            {executed ? (
              <>
                <CheckCircle2 size={15} />
                <span>Action Executed & Verified</span>
              </>
            ) : executing ? (
              <span>Executing Autonomous Loop...</span>
            ) : (
              <>
                <span>Approve & Execute</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

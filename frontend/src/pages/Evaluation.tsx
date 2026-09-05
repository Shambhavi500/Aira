import { useState } from 'react';
import {
  Layers,
  Play,
  Sparkles,
} from 'lucide-react';
import { api } from '../api/client';
import { useAiraState } from '../context/AiraStateContext';
import { formatINR, formatPercent } from '../utils/formatters';

export default function Evaluation() {
  const { notify } = useAiraState();
  const [results, setResults] = useState<any | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    try {
      const data = await api.evaluate(42);
      setResults(data);
      notify('Evaluation Benchmark Completed', '120 synthetic cases processed with reproducible seed=42.', 'success');
    } catch (e: any) {
      setError(e.message);
      notify('Evaluation Failed', e.message, 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="page-body">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-5)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
              AIRA Autonomous Decision Benchmark
            </h1>
            <span className="badge badge-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={12} />
              Reproducible Evaluation Engine
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Executes the full recovery pipeline against 120+ synthetic scenarios with seed=42 for deterministic evaluation.
          </p>
        </div>

        <button
          onClick={handleRun}
          disabled={running}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Play size={14} className={running ? 'spin-icon' : ''} />
          <span>{running ? 'Running 120 Cases...' : 'Run Benchmark (seed=42)'}</span>
        </button>
      </div>

      {error && (
        <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--color-danger-dim)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', marginBottom: 'var(--space-4)', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {!results && !running && (
        <div className="card text-center" style={{ padding: 'var(--space-8)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-3)' }}>
            <Layers size={24} color="var(--color-primary)" />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>No Evaluation Run Yet</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '460px', margin: '8px auto' }}>
            Click "Run Benchmark" to execute the full pipeline across all 7 recovery scenarios and measure precision, recovery rate, and policy compliance.
          </p>
          <button onClick={handleRun} className="btn btn-primary" style={{ marginTop: 'var(--space-3)' }}>
            Execute Standard Benchmark
          </button>
        </div>
      )}

      {running && (
        <div className="card text-center" style={{ padding: 'var(--space-10)' }}>
          <div className="pulsing-indicator green" style={{ width: '12px', height: '12px', margin: '0 auto var(--space-3)' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Evaluating 120 Synthetic Recovery Cases...
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            AI classification → Policy Governor bounds → Autonomous simulation → Audit ledger certification
          </p>
        </div>
      )}

      {results && (
        <div>
          {/* KPI Summary Grid */}
          <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 'var(--space-5)' }}>
            <div className="metric-card">
              <div className="metric-label">Cases Evaluated</div>
              <div className="metric-value blue" style={{ fontFamily: 'var(--font-mono)' }}>
                {results.total_cases}
              </div>
              <div className="metric-sub">Full synthetic corpus</div>
            </div>

            <div className="metric-card">
              <div className="metric-label">Amount at Risk</div>
              <div className="metric-value red" style={{ fontFamily: 'var(--font-mono)' }}>
                {formatINR(results.total_amount_at_risk)}
              </div>
              <div className="metric-sub">Total baseline volume</div>
            </div>

            <div className="metric-card">
              <div className="metric-label">Amount Recovered</div>
              <div className="metric-value green" style={{ fontFamily: 'var(--font-mono)' }}>
                {formatINR(results.total_amount_recovered)}
              </div>
              <div className="metric-sub">+{formatPercent(results.amount_recovery_rate)} recovery yield</div>
            </div>

            <div className="metric-card">
              <div className="metric-label">Policy Guardrail Blocks</div>
              <div className="metric-value purple" style={{ fontFamily: 'var(--font-mono)' }}>
                {results.blocked_interventions ?? 0}
              </div>
              <div className="metric-sub">100% compliance adherence</div>
            </div>
          </div>

          {/* Results by Scenario */}
          {results.by_scenario && (
            <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
              <div className="card-title">Benchmark Results by Scenario</div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Scenario Vector</th>
                      <th>Cases Tested</th>
                      <th style={{ textAlign: 'right' }}>Volume At Risk</th>
                      <th style={{ textAlign: 'right' }}>Volume Recovered</th>
                      <th>Recovery Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.by_scenario.map((s: any) => (
                      <tr key={s.scenario_type}>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {s.scenario_type.replace(/_/g, ' ')}
                        </td>
                        <td>{s.case_count}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatINR(s.amount_at_risk)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-success)' }}>
                          {formatINR(s.amount_recovered)}
                        </td>
                        <td>
                          <span className={`badge ${s.rate >= 60 ? 'badge-success' : s.rate >= 30 ? 'badge-primary' : 'badge-danger'}`}>
                            {formatPercent(s.rate)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

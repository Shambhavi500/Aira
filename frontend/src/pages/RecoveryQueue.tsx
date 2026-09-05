import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  Search,
  Sparkles,
  Play,
  CheckSquare,
  Square,
} from 'lucide-react';
import { api } from '../api/client';
import type { RecoveryCase, PaginatedResponse } from '../api/client';
import { useAiraState } from '../context/AiraStateContext';
import { formatINR } from '../utils/formatters';

export default function RecoveryQueue() {
  const { refreshMetrics, notify } = useAiraState();
  const [data, setData] = useState<PaginatedResponse<RecoveryCase> | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [scenarioFilter, setScenarioFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [executingAction, setExecutingAction] = useState<string | null>(null);

  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (scenarioFilter) params.scenario_type = scenarioFilter;
      const res = await api.cases(params);
      setData(res);
    } catch (e: any) {
      notify('Failed to load queue', e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [search, statusFilter, scenarioFilter]);

  const cases = useMemo(() => data?.items || [], [data?.items]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === cases.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(cases.map((c) => c.id)));
    }
  };

  const handleRunSingle = async (id: string) => {
    setExecutingAction(id);
    try {
      await api.runCase(id);
      notify('Autonomous Case Execution Completed', `Processed case ${id.slice(0, 8)}... through AI pipeline.`, 'success');
      await refreshMetrics();
      await load();
    } catch (e: any) {
      notify('Execution Failed', e.message, 'error');
    } finally {
      setExecutingAction(null);
    }
  };

  const handleBulkAction = async (action: 'run' | 'escalate') => {
    if (selectedIds.size === 0) return;
    setExecutingAction('bulk');
    try {
      for (const id of selectedIds) {
        if (action === 'run') await api.runCase(id);
        else if (action === 'escalate') await api.escalateCase(id, 'Bulk operator escalation');
      }
      notify('Bulk Action Executed', `Processed ${selectedIds.size} cases.`, 'success');
      setSelectedIds(new Set());
      await refreshMetrics();
      await load();
    } catch (e: any) {
      notify('Bulk Action Failed', e.message, 'error');
    } finally {
      setExecutingAction(null);
    }
  };

  return (
    <div className="page-body">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-5)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Unified Autonomous Recovery Queue
            </h1>
            <span className="badge badge-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={12} />
              AI Pipeline Inspector
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Multi-vector recovery pipeline execution with case-level AI reasoning, simulation loops, and policy auditing.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button onClick={load} disabled={loading} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} className={loading ? 'spin-icon' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-surface)', padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
              <Search size={14} color="var(--text-muted)" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search case ID, customer..."
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '12px' }}
            >
              <option value="">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RECOVERED">Recovered</option>
              <option value="ESCALATED">Escalated</option>
              <option value="BLOCKED">Blocked</option>
            </select>

            {/* Scenario Filter */}
            <select
              value={scenarioFilter}
              onChange={(e) => setScenarioFilter(e.target.value)}
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '12px' }}
            >
              <option value="">All Scenarios</option>
              <option value="FAILED_SUBSCRIPTION">Failed Subscription</option>
              <option value="CHECKOUT_DROPOFF">Checkout Dropoff</option>
              <option value="B2B_RECEIVABLE">B2B Receivable</option>
              <option value="MANDATE_RETRY">Mandate Retry</option>
              <option value="PAYMENT_DEGRADATION">Payment Degradation</option>
              <option value="VOICE_RECOVERY">Voice Recovery</option>
            </select>
          </div>

          {/* Bulk Action Controls */}
          {selectedIds.size > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{selectedIds.size} selected</span>
              <button
                onClick={() => handleBulkAction('run')}
                disabled={executingAction === 'bulk'}
                className="btn btn-primary"
                style={{ fontSize: '11px', padding: '4px 8px' }}
              >
                Run AI Loop
              </button>
              <button
                onClick={() => handleBulkAction('escalate')}
                disabled={executingAction === 'bulk'}
                className="btn btn-secondary"
                style={{ fontSize: '11px', padding: '4px 8px' }}
              >
                Escalate
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cases Table */}
      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <button onClick={toggleSelectAll} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    {selectedIds.size === cases.length && cases.length > 0 ? <CheckSquare size={16} color="var(--color-primary)" /> : <Square size={16} />}
                  </button>
                </th>
                <th>Case ID / Scenario</th>
                <th>Customer / Client</th>
                <th style={{ textAlign: 'right' }}>Amount At Risk</th>
                <th style={{ textAlign: 'right' }}>Recovered</th>
                <th>Root Cause</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {cases.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 'var(--space-5)', color: 'var(--text-muted)' }}>
                    No recovery cases found matching filter criteria
                  </td>
                </tr>
              ) : (
                cases.map((c) => {
                  const isSelected = selectedIds.has(c.id);
                  const isRec = c.status === 'RECOVERED';
                  return (
                    <tr key={c.id} onClick={() => navigate(`/case/${c.id}`)} style={{ cursor: 'pointer' }}>
                      <td onClick={(e) => { e.stopPropagation(); toggleSelect(c.id); }}>
                        {isSelected ? <CheckSquare size={16} color="var(--color-primary)" /> : <Square size={16} color="var(--text-muted)" />}
                      </td>
                      <td>
                        <div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-primary)', fontWeight: 600 }}>
                            {c.id.slice(0, 13)}...
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                            {c.scenario_type.replace(/_/g, ' ')}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.customer_name || 'Enterprise Client'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.payment_method || 'UPI / e-Mandate'}</div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-danger)' }}>
                          {formatINR(c.amount_at_risk)}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: isRec ? 'var(--color-success)' : 'var(--text-muted)' }}>
                          {formatINR(c.amount_recovered)}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-subtle">{c.root_cause ? c.root_cause.replace(/_/g, ' ') : 'TIMEOUT'}</span>
                      </td>
                      <td>
                        <span className={`badge ${isRec ? 'badge-success' : c.status === 'BLOCKED' ? 'badge-danger' : 'badge-primary'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {!isRec && (
                            <button
                              onClick={() => handleRunSingle(c.id)}
                              disabled={executingAction === c.id}
                              className="btn btn-primary"
                              style={{ fontSize: '11px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Play size={11} />
                              <span>{executingAction === c.id ? 'Running...' : 'Run'}</span>
                            </button>
                          )}
                          <button
                            onClick={() => navigate(`/case/${c.id}`)}
                            className="btn btn-secondary"
                            style={{ fontSize: '11px', padding: '4px 8px' }}
                          >
                            Details
                          </button>
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
    </div>
  );
}

import { useState } from 'react';
import type { FC } from 'react';
import { X, CheckCircle2, ShieldCheck, Zap, ArrowRight, ShieldAlert } from 'lucide-react';
import { useAiraState } from '../context/AiraStateContext';
import { useNavigate } from 'react-router-dom';

export const NotificationDrawer: FC = () => {
  const {
    isNotificationDrawerOpen,
    setNotificationDrawerOpen,
    notifications,
    markNotificationsRead,
  } = useAiraState();
  const [filter, setFilter] = useState<'ALL' | 'RECOVERY' | 'POLICY'>('ALL');
  const navigate = useNavigate();

  if (!isNotificationDrawerOpen) return null;

  const filtered = notifications.filter((n) => {
    if (filter === 'RECOVERY') return n.action.toLowerCase().includes('recover') || n.event_type.includes('RECOVERY');
    if (filter === 'POLICY') return n.event_type.includes('POLICY') || n.actor.includes('GOVERNOR');
    return true;
  });

  const handleClose = () => {
    markNotificationsRead();
    setNotificationDrawerOpen(false);
  };

  const getEventIcon = (event: any) => {
    if (event.action?.toLowerCase().includes('recover')) {
      return <CheckCircle2 size={16} color="var(--color-success)" />;
    }
    if (event.action?.toLowerCase().includes('block')) {
      return <ShieldAlert size={16} color="var(--color-danger)" />;
    }
    if (event.actor === 'POLICY_GOVERNOR') {
      return <ShieldCheck size={16} color="var(--color-purple)" />;
    }
    return <Zap size={16} color="var(--color-primary)" />;
  };

  return (
    <div className="notification-drawer-overlay" onClick={handleClose}>
      <div className="notification-drawer" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Live Autonomous Feed</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Realtime AI Decisions & Ledger Events</p>
          </div>
          <button
            onClick={handleClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter Tabs */}
        <div style={{ display: 'flex', padding: 'var(--space-2) var(--space-5)', gap: 'var(--space-2)', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}>
          {(['ALL', 'RECOVERY', 'POLICY'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              style={{
                background: filter === tab ? 'var(--color-primary-dim)' : 'transparent',
                color: filter === tab ? 'var(--color-primary)' : 'var(--text-secondary)',
                border: 'none',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {tab === 'ALL' ? 'All Activity' : tab === 'RECOVERY' ? 'Recoveries' : 'Policy Ledger'}
            </button>
          ))}
        </div>

        {/* Notification Stream */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)', fontSize: '13px' }}>
              No activity logs found for this filter.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {filtered.map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-3) var(--space-4)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    cursor: item.case_id ? 'pointer' : 'default',
                    transition: 'border-color var(--transition-fast)',
                  }}
                  onClick={() => {
                    if (item.case_id) {
                      handleClose();
                      navigate(`/case/${item.case_id}`);
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {getEventIcon(item)}
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.event_type}</span>
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(item.timestamp || item.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.action}</div>
                  {item.reason && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '4px 8px', borderRadius: '4px', marginTop: '2px' }}>
                      {item.reason}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-disabled)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Actor: {item.actor}
                    </span>
                    {item.case_id && (
                      <span style={{ fontSize: '11px', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                        View Case <ArrowRight size={10} />
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div style={{ padding: 'var(--space-3) var(--space-5)', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-card)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Continuous Cryptographic Sync</span>
          <button
            onClick={() => {
              handleClose();
              navigate('/audit-trail');
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-primary)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            Full Audit Ledger <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};

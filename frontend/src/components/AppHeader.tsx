import { useState } from 'react';
import type { FC, ReactNode } from 'react';
import { Search, Bell, RefreshCw, Sparkles, Sun, Moon, ChevronRight } from 'lucide-react';
import { useAiraState } from '../context/AiraStateContext';
import { api } from '../api/client';
import symbolMark from '../assets/aira-symbol.png';

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

export const AppHeader: FC<AppHeaderProps> = ({ title, subtitle, actions }) => {
  const {
    theme,
    toggleTheme,
    unreadNotificationCount,
    setNotificationDrawerOpen,
    setCommandPaletteOpen,
    refreshMetrics,
    notify,
    askAssistant,
  } = useAiraState();
  const [reloading, setReloading] = useState(false);

  const handleQuickSeed = async () => {
    setReloading(true);
    try {
      const res = await api.seedData(120);
      notify('Synthetic Pipeline Synced', res.message || '120 realistic recovery scenarios populated.', 'success');
      await refreshMetrics();
    } catch (err: any) {
      notify('Sync Failed', err.message || 'Could not sync database.', 'error');
    } finally {
      setReloading(false);
    }
  };

  return (
    <header className="page-header">
      {/* Title / Context & Breadcrumbs */}
      <div>
        <div className="header-breadcrumb" style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
          <img src={symbolMark} alt="AIRA" style={{ width: '13px', height: '13px', objectFit: 'contain' }} />
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>AIRA</span>
          <ChevronRight size={10} />
          <span>Operations</span>
          <ChevronRight size={10} />
          <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{title || 'Command Center'}</span>
        </div>
        <h1 className="page-title" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title || 'Command Center'}</h1>
        {subtitle && <p className="page-subtitle" style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '1px 0 0 0' }}>{subtitle}</p>}
      </div>

      {/* Center / Subtle Autonomous Engine Status Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', fontSize: '12px' }}>
        <img src={symbolMark} alt="" style={{ width: '14px', height: '14px', objectFit: 'contain', opacity: 0.9 }} />
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block', boxShadow: '0 0 6px rgba(4, 219, 124, 0.4)' }} />
        <span style={{ fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.2px' }}>Autonomous Engine Operational</span>
      </div>

      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        {actions}

        {/* Global Search Trigger */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            padding: '6px 12px',
            color: 'var(--text-muted)',
            fontSize: '12px',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
            transition: 'all var(--transition-fast)',
          }}
          title="Search anything (⌘K)"
        >
          <Search size={14} color="var(--text-muted)" />
          <span style={{ display: 'inline-block', minWidth: '100px', textAlign: 'left', color: 'var(--text-secondary)' }}>Search cases, ops...</span>
          <kbd style={{ background: 'var(--bg-secondary)', padding: '1px 5px', borderRadius: '3px', fontSize: '10px', border: '1px solid var(--border-default)', color: 'var(--text-muted)', fontWeight: 600 }}>
            ⌘K
          </kbd>
        </button>

        {/* Ask Aira Assistant Trigger */}
        <button
          onClick={() => askAssistant(`Explain the ${title || 'active'} screen I'm viewing`)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--color-primary-dim)',
            border: '1px solid rgba(13, 148, 251, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '6px 12px',
            color: 'var(--color-primary)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
          title="Ask Aira Copilot about this screen"
        >
          <Sparkles size={13} />
          <span>Ask Aira</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            padding: '6px 10px',
            color: 'var(--text-secondary)',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`}
        >
          {theme === 'dark' ? <Sun size={13} color="#F59E0B" /> : <Moon size={13} color="#0D94FB" />}
          <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>

        {/* Quick Sync / Seed Button */}
        <button
          onClick={handleQuickSeed}
          disabled={reloading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            padding: '6px 10px',
            color: 'var(--text-secondary)',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
          title="Sync Synthetic Pipeline & Recompute Metrics"
        >
          <RefreshCw size={13} className={reloading ? 'spin-icon' : ''} />
          <span>Sync Data</span>
        </button>
        {/* Notification Bell */}
        <button
          onClick={() => setNotificationDrawerOpen(true)}
          style={{
            position: 'relative',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            padding: '7px',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-sm)',
            transition: 'all var(--transition-fast)',
          }}
          title="Live AI Telemetry & Audit Stream"
        >
          <Bell size={15} />
          {unreadNotificationCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                width: '14px',
                height: '14px',
                background: 'var(--color-danger)',
                borderRadius: '50%',
                fontSize: '9px',
                fontWeight: 700,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {unreadNotificationCount}
            </span>
          )}
        </button>

        {/* Operator Profile Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '3px 8px',
            fontSize: '12px',
          }}
          title="Fintech Recovery Operations Desk"
        >
          <div
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: 'var(--color-primary-dim)',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 700,
            }}
          >
            OP
          </div>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>Admin</span>
        </div>
      </div>
    </header>
  );
};

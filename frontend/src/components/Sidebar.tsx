import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  ShoppingCart,
  RefreshCw,
  FileText,
  GitMerge,
  PhoneCall,
  CalendarCheck,
  MessageSquare,
  BarChart3,
  ShieldCheck,
  Layers,
  History,
  Play,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAiraState } from '../context/AiraStateContext';
import logoFull from '../assets/aira-logo-full.png';
import symbolMark from '../assets/aira-symbol.png';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const location = useLocation();
  const { metrics, setWelcomeOpen } = useAiraState();

  const navSections = [
    {
      label: 'CORE',
      items: [
        { path: '/', label: 'Command Center', icon: LayoutDashboard, exact: true },
        { path: '/payment-health', label: 'Payment Degradation', icon: Activity, badge: metrics?.active_cases ? `${metrics.active_cases}` : undefined },
        { path: '/checkout', label: 'Checkout Recovery', icon: ShoppingCart },
        { path: '/subscriptions', label: 'Subscription Retry', icon: RefreshCw },
      ],
    },
    {
      label: 'AUTONOMOUS OPS',
      items: [
        { path: '/receivables', label: 'B2B Receivables', icon: FileText },
        { path: '/mandates', label: 'Mandate Sequencer', icon: GitMerge },
        { path: '/voice-recovery', label: 'Voice AI Agent', icon: PhoneCall },
        { path: '/promise-tracker', label: 'Promise Tracker', icon: CalendarCheck },
        { path: '/conversations', label: 'Omni Communications', icon: MessageSquare },
        { path: '/recovery', label: 'Recovery Queue', icon: Play },
      ],
    },
    {
      label: 'INSIGHTS',
      items: [
        { path: '/analytics', label: 'Financial Intelligence', icon: BarChart3 },
        { path: '/policy-governor', label: 'Policy Governor', icon: ShieldCheck },
        { path: '/audit-trail', label: 'Audit Trail', icon: History },
        { path: '/evaluation', label: 'Agent Evaluation', icon: Layers },
      ],
    },
  ];

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Brand Header */}
      <div className="sidebar-logo">
        <NavLink
          to="/"
          className="sidebar-logo-link"
          title="AIRA — Recover More. Do More."
          onClick={() => {
            if (location.pathname === '/') {
              setWelcomeOpen(true);
            }
          }}
        >
          <img
            src={symbolMark}
            alt="AIRA — Recover More. Do More."
            className="sidebar-symbol-logo"
            style={{ display: collapsed ? 'block' : 'none' }}
          />
          <img
            src={logoFull}
            alt="AIRA — Recover More. Do More."
            className="sidebar-full-logo"
            style={{ display: collapsed ? 'none' : 'block' }}
          />
        </NavLink>
      </div>

      {/* Navigation Links */}
      <div className="sidebar-nav">
        {navSections.map((section, sIdx) => (
          <div key={sIdx} className="nav-section">
            {!collapsed && <div className="nav-section-label">{section.label}</div>}
            {section.items.map((item, iIdx) => {
              const Icon = item.icon;
              const isActive = item.exact
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path) && (item.path !== '/' || location.pathname === '/');

              return (
                <NavLink
                  key={iIdx}
                  to={item.path}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="nav-item-icon" />
                  {!collapsed && <span className="nav-item-label">{item.label}</span>}
                  {!collapsed && item.badge && <span className="nav-badge">{item.badge}</span>}
                </NavLink>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer / Collapse Toggle */}
      <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between' }}>
        {!collapsed && (
          <div className="sidebar-footer-text" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-success)', marginRight: '6px' }}></span>
            AIRA Engine Active
          </div>
        )}
        <button className="sidebar-toggle-btn" onClick={onToggle} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </aside>
  );
};

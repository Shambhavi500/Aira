import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { useAiraState } from '../context/AiraStateContext';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useAiraState();

  if (toasts.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={18} color="var(--color-success)" />;
      case 'error':
        return <XCircle size={18} color="var(--color-danger)" />;
      case 'warning':
        return <AlertTriangle size={18} color="var(--color-warning)" />;
      default:
        return <Info size={18} color="var(--color-primary)" />;
    }
  };

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-item ${toast.type}`}>
          <div style={{ flexShrink: 0, marginTop: '2px' }}>{getIcon(toast.type)}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{toast.title}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{toast.message}</div>
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};

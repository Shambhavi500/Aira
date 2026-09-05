import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { FC, ReactNode } from 'react';
import { api } from '../api/client';
import { dataService } from '../services/dataService';
import type { OverviewMetrics, AuditEvent } from '../api/client';

interface Toast {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  timestamp: number;
}

export interface ActiveEntityContext {
  customerName?: string;
  customerPhone?: string;
  amountAtRisk?: number;
  caseId?: string;
  paymentId?: string;
  invoiceId?: string;
  riskTier?: string;
  rootCause?: string;
  moduleName?: string;
  currentModule?: string;
  scenario?: string;
  suggestedAction?: string;
}

interface AiraStateContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  metrics: OverviewMetrics | null;
  loadingMetrics: boolean;
  refreshMetrics: () => Promise<void>;
  notifications: AuditEvent[];
  unreadNotificationCount: number;
  markNotificationsRead: () => void;
  toasts: Toast[];
  notify: (title: string, message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  removeToast: (id: string) => void;
  isCommandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  isNotificationDrawerOpen: boolean;
  setNotificationDrawerOpen: (open: boolean) => void;
  isAssistantOpen: boolean;
  setAssistantOpen: (open: boolean) => void;
  isWelcomeOpen: boolean;
  setWelcomeOpen: (open: boolean) => void;
  pendingAssistantPrompt: string | null;
  askAssistant: (prompt?: string) => void;
  clearPendingAssistantPrompt: () => void;
  activeEntityContext: ActiveEntityContext | null;
  setActiveEntityContext: (ctx: ActiveEntityContext | null) => void;
}

const AiraStateContext = createContext<AiraStateContextType | undefined>(undefined);

export const AiraStateProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('aira_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });
  const [activeEntityContext, setActiveEntityContext] = useState<ActiveEntityContext | null>(null);
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState<boolean>(true);
  const [notifications, setNotifications] = useState<AuditEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(3);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);
  const [isNotificationDrawerOpen, setNotificationDrawerOpen] = useState<boolean>(false);
  const [isAssistantOpen, setAssistantOpen] = useState<boolean>(false);
  const [isWelcomeOpen, setWelcomeOpen] = useState<boolean>(false);
  const [pendingAssistantPrompt, setPendingAssistantPrompt] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('aira_theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const refreshMetrics = useCallback(async () => {
    try {
      const data = await api.metrics();
      setMetrics(data);
    } catch (err) {
      console.error('Failed to load overview metrics:', err);
    } finally {
      setLoadingMetrics(false);
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    try {
      const act = await api.recentActivity();
      setNotifications(act || []);
    } catch (err) {
      console.error('Failed to load recent activity:', err);
    }
  }, []);

  useEffect(() => {
    refreshMetrics();
    refreshNotifications();

    // Subscribe to authoritative DataService mutations
    const unsubscribeDataService = dataService.subscribe(() => {
      refreshMetrics();
      refreshNotifications();
    });

    // Global keyboard listener for ⌘K / Ctrl+K
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
        setNotificationDrawerOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      unsubscribeDataService();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [refreshMetrics, refreshNotifications]);

  const notify = useCallback(
    (title: string, message: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: Toast = { id, title, message, type, timestamp: Date.now() };
      setToasts((prev) => [...prev.slice(-4), newToast]);

      // Auto dismiss after 4.5 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const markNotificationsRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const askAssistant = useCallback((prompt?: string) => {
    if (prompt) {
      setPendingAssistantPrompt(prompt);
    }
    setAssistantOpen(true);
  }, []);

  const clearPendingAssistantPrompt = useCallback(() => {
    setPendingAssistantPrompt(null);
  }, []);

  return (
    <AiraStateContext.Provider
      value={{
        theme,
        toggleTheme,
        metrics,
        loadingMetrics,
        refreshMetrics,
        notifications,
        unreadNotificationCount: unreadCount,
        markNotificationsRead,
        toasts,
        notify,
        removeToast,
        isCommandPaletteOpen,
        setCommandPaletteOpen,
        isNotificationDrawerOpen,
        setNotificationDrawerOpen,
        isAssistantOpen,
        setAssistantOpen,
        isWelcomeOpen,
        setWelcomeOpen,
        pendingAssistantPrompt,
        askAssistant,
        clearPendingAssistantPrompt,
        activeEntityContext,
        setActiveEntityContext,
      }}
    >
      {children}
    </AiraStateContext.Provider>
  );
};

export const useAiraState = () => {
  const context = useContext(AiraStateContext);
  if (!context) {
    throw new Error('useAiraState must be used within an AiraStateProvider');
  }
  return context;
};

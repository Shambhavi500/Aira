/**
 * Financial & Telemetry Formatting Utilities
 * Strictly adheres to the zero-data rule:
 * - Real zero (0) renders as '₹0'
 * - Missing data (null, undefined, NaN) renders as '—'
 * - Indian number system grouping (Lakhs / Crores)
 */

export interface FormatINROptions {
  compact?: boolean;
  decimals?: number;
  showZeroAsDash?: boolean;
}

/**
 * Formats a numeric amount in Indian Rupees (INR).
 *
 * @example
 * formatINR(1000) => "₹1,000"
 * formatINR(12500) => "₹12,500"
 * formatINR(125000, { compact: true }) => "₹1.25L"
 * formatINR(12500000, { compact: true }) => "₹1.25Cr"
 * formatINR(0) => "₹0"
 * formatINR(null) => "—"
 * formatINR(undefined) => "—"
 */
export function formatINR(
  amount: number | null | undefined,
  options?: FormatINROptions
): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return '—';
  }

  const num = Number(amount);
  if (num === 0) {
    if (options?.showZeroAsDash) return '—';
    return '₹0';
  }

  const isNegative = num < 0;
  const abs = Math.abs(num);
  const prefix = isNegative ? '-₹' : '₹';

  if (options?.compact) {
    if (abs >= 10000000) {
      const cr = abs / 10000000;
      return `${prefix}${cr.toFixed(cr % 1 === 0 ? 0 : (options.decimals ?? 2))}Cr`;
    }
    if (abs >= 100000) {
      const l = abs / 100000;
      return `${prefix}${l.toFixed(l % 1 === 0 ? 0 : (options.decimals ?? 2))}L`;
    }
    if (abs >= 1000) {
      const k = abs / 1000;
      return `${prefix}${k.toFixed(k % 1 === 0 ? 0 : (options.decimals ?? 1))}K`;
    }
  }

  const maxDecimals = options?.decimals !== undefined ? options.decimals : 0;
  const formatted = abs.toLocaleString('en-IN', {
    maximumFractionDigits: maxDecimals,
    minimumFractionDigits: maxDecimals > 0 ? maxDecimals : 0,
  });

  return `${prefix}${formatted}`;
}

/**
 * Formats a percentage value.
 * @example
 * formatPercent(86.42) => "86.4%"
 * formatPercent(0) => "0.0%"
 * formatPercent(null) => "—"
 */
export function formatPercent(
  value: number | null | undefined,
  decimals = 1
): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  return `${Number(value).toFixed(decimals)}%`;
}

/**
 * Formats an ISO date string or Date object into human-readable Indian date.
 */
export function formatDate(
  dateInput: string | Date | null | undefined,
  includeTime = false
): string {
  if (!dateInput) return '—';
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (Number.isNaN(d.getTime())) return '—';

    if (includeTime) {
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

/**
 * Formats relative time (e.g. "5m ago", "2h ago", "yesterday", "in 3 days").
 */
export function formatRelativeTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—';
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (Number.isNaN(d.getTime())) return '—';

    const now = Date.now();
    const diffMs = now - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 0) {
      // Future
      const absSec = Math.abs(diffSec);
      if (absSec < 60) return 'in moments';
      if (absSec < 3600) return `in ${Math.floor(absSec / 60)}m`;
      if (absSec < 86400) return `in ${Math.floor(absSec / 3600)}h`;
      return `in ${Math.floor(absSec / 86400)}d`;
    }

    if (diffSec < 45) return 'just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;

    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
}

/**
 * Formats duration in seconds into mm:ss or hh:mm:ss.
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(Number(seconds))) return '—';
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) {
    return `${h}h ${m}m ${s}s`;
  }
  if (m > 0) {
    return `${m}m ${s}s`;
  }
  return `${s}s`;
}

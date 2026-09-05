import { useState, useEffect, useRef } from 'react';
import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowRight, Sparkles, FileText, ShoppingCart, RefreshCw, Activity, PhoneCall, CalendarCheck } from 'lucide-react';
import { useAiraState } from '../context/AiraStateContext';
import { api } from '../api/client';
import type { SearchResultItem } from '../api/client';
import symbolMark from '../assets/aira-symbol.png';

export const CommandPalette: FC = () => {
  const { isCommandPaletteOpen, setCommandPaletteOpen, setWelcomeOpen } = useAiraState();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      search('');
    } else {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isCommandPaletteOpen]);

  const search = async (q: string) => {
    setLoading(true);
    try {
      const res = await api.search(q);
      const items: SearchResultItem[] = [...(res.results || [])];
      const qLower = q.toLowerCase();
      if (!q || 'aira brand about welcome recover do more'.split(' ').some((k) => qLower.includes(k))) {
        items.unshift({
          id: 'brand-welcome',
          title: 'AIRA — Recover More. Do More.',
          subtitle: 'Platform overview, brand architecture & intelligent recovery flow',
          type: 'brand',
          route: '/',
          badge: 'About AIRA',
        });
      }
      setResults(items);
      setSelectedIndex(0);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    search(val);
  };

  const handleSelect = (item: SearchResultItem) => {
    setCommandPaletteOpen(false);
    if (item.type === 'brand') {
      setWelcomeOpen(true);
      return;
    }
    navigate(item.route);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setCommandPaletteOpen(false);
    }
  };

  if (!isCommandPaletteOpen) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'case':
        return <Activity size={15} color="var(--color-primary)" />;
      case 'invoice':
        return <FileText size={15} color="var(--color-warning)" />;
      case 'checkout':
        return <ShoppingCart size={15} color="var(--color-purple)" />;
      case 'mandate':
        return <RefreshCw size={15} color="var(--color-cyan)" />;
      case 'voice':
        return <PhoneCall size={15} color="var(--color-orange)" />;
      case 'promise':
        return <CalendarCheck size={15} color="var(--color-success)" />;
      case 'brand':
        return <img src={symbolMark} alt="AIRA" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />;
      default:
        return <Sparkles size={15} color="var(--text-muted)" />;
    }
  };

  return (
    <div className="command-palette-overlay" onClick={() => setCommandPaletteOpen(false)}>
      <div className="command-palette-modal" onClick={(e) => e.stopPropagation()}>
        {/* Search Header */}
        <div className="command-palette-search">
          <Search size={18} color="var(--text-muted)" />
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder="Search recovery cases, invoices, dropoffs, or type a command..."
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
          />
          {loading && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Searching...</span>}
        </div>

        {/* Results List */}
        <div className="command-palette-list">
          {results.length === 0 && !loading && (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No matches found for "{query}".
            </div>
          )}

          {results.map((item, idx) => (
            <div
              key={item.id}
              className={`command-palette-item ${selectedIndex === idx ? 'selected' : ''}`}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{ background: 'var(--bg-card)', padding: '6px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {getIcon(item.type)}
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{item.subtitle}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span className="badge badge-subtle">{item.badge}</span>
                <ArrowRight size={14} color="var(--text-muted)" />
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="command-palette-footer">
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <div>AIRA Global Unified Index</div>
        </div>
      </div>
    </div>
  );
};

import { useEffect, useState } from 'react';
import { navigate, ROUTES } from '../utils/router';

const NAV_ITEMS = [
  { label: 'Today', category: 'All' },
  { label: 'Research', category: 'AI Research' },
  { label: 'Models', category: 'Model Release' },
  { label: 'Open Source', category: 'Open Source AI' },
  { label: 'Companies', category: 'AI Companies' },
];

const THEME_OPTIONS = [
  { value: 'sys', label: 'Sys' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function TopNav({ activeCategory, onNavigate, onRefresh, refreshing, status, themePreference, onThemeChange }) {
  const sourceCount = status?.sources?.enabled ?? '—';
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnEscape = event => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  function goCategory(category) {
    onNavigate(category);
    setMenuOpen(false);
  }

  return (
    <header className="nav">
      <div className="nav-in">
        <a
          className="brand"
          href={ROUTES.HOME}
          aria-label="AI News Aggregator — home"
          onClick={e => { e.preventDefault(); navigate(ROUTES.HOME); }}
        >
          <span className="brand-mark" aria-hidden="true">AI</span>
          <span className="brand-copy">
            <span className="brand-name">AI News Aggregator</span>
            <span className="brand-sub">Live monitor</span>
          </span>
        </a>

        <nav className="nav-links" aria-label="Primary navigation">
          {NAV_ITEMS.map(item => (
            <button
              key={item.label}
              type="button"
              className={`nav-link${activeCategory === item.category ? ' on' : ''}`}
              aria-current={activeCategory === item.category ? 'true' : undefined}
              onClick={() => goCategory(item.category)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="nav-side">
          <span className="live">
            <span className="dot dot-live" aria-hidden="true" />
            <span className="live-word"><b>{sourceCount}</b> active · {status?.sources?.healthy ?? '—'} healthy</span>
          </span>

          <fieldset id="color-scheme" className="theme-seg" aria-label="Display theme">
            <legend className="sr-only">Display theme</legend>
            {THEME_OPTIONS.map(option => (
              <label key={option.value} className={themePreference === option.value ? 'on' : ''}>
                <input
                  type="radio"
                  name="theme"
                  value={option.value}
                  checked={themePreference === option.value}
                  onChange={e => onThemeChange(e.target.value)}
                />
                {option.label}
              </label>
            ))}
          </fieldset>

          <button
            type="button"
            className="btn btn-refresh"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh news feed"
          >
            <span className={refreshing ? 'spin' : ''} aria-hidden="true">↻</span>
            <span>{refreshing ? 'Syncing' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            className="menu-btn"
            aria-label={menuOpen ? 'Close' : 'Menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen(open => !open)}
          >
            <span className="bars" aria-hidden="true"><i /><i /><i /></span>
            <span className="menu-word">{menuOpen ? 'Close' : 'Menu'}</span>
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav id="mobile-navigation" className="mobile-nav open" aria-label="Mobile primary navigation">
          {NAV_ITEMS.map(item => (
            <button
              key={item.label}
              type="button"
              className={`nav-link${activeCategory === item.category ? ' on' : ''}`}
              onClick={() => goCategory(item.category)}
            >
              <span>{item.label}</span>
              <span aria-hidden="true">→</span>
            </button>
          ))}
        </nav>
      )}
    </header>
  );
}

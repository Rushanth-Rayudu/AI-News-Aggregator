const NAV_ITEMS = [
  { label: 'Today', category: 'All' },
  { label: 'Research', category: 'AI Research' },
  { label: 'Models', category: 'Model Release' },
  { label: 'Open Source', category: 'Open Source AI' },
  { label: 'Companies', category: 'AI Companies' },
];

export default function TopNav({ activeCategory, onNavigate, onRefresh, refreshing, status, theme, themePreference, onThemeChange }) {
  const sourceCount = status?.sources?.total ?? '—';

  return (
    <header className="top-nav">
      <div className="brand-panel">
        <div className="brand-mark">AI</div>
        <div className="brand-copy">
          <div className="brand-name">AI Intelligence</div>
          <div className="brand-tagline">Filtered insights from the feeds that matter.</div>
        </div>
      </div>

      <nav className="top-links" aria-label="Primary navigation">
        {NAV_ITEMS.map(item => (
          <button
            key={item.label}
            type="button"
            className={`nav-pill${activeCategory === item.category ? ' active' : ''}`}
            onClick={() => onNavigate(item.category)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="top-actions">
        <fieldset id="color-scheme" className="theme-switcher" aria-label="Theme selector">
          <legend>Theme</legend>
          <label htmlFor="system" tabIndex="0">
            <input
              type="radio"
              id="system"
              name="theme"
              value="system"
              tabIndex="-1"
              checked={themePreference === 'system'}
              onChange={e => onThemeChange(e.target.value)}
            />
            <span>Sys</span>
          </label>
          <label htmlFor="light" tabIndex="0">
            <input
              type="radio"
              id="light"
              name="theme"
              value="light"
              tabIndex="-1"
              checked={themePreference === 'light'}
              onChange={e => onThemeChange(e.target.value)}
            />
            <span>Light</span>
          </label>
          <label htmlFor="dark" tabIndex="0">
            <input
              type="radio"
              id="dark"
              name="theme"
              value="dark"
              tabIndex="-1"
              checked={themePreference === 'dark'}
              onChange={e => onThemeChange(e.target.value)}
            />
            <span>Dark</span>
          </label>
        </fieldset>

        <div className="status-pill">
          <span className="status-dot live" />
          <span>Monitoring {sourceCount} feeds</span>
        </div>

        <button
          type="button"
          className="btn-refresh"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh news feed"
        >
          <span className={refreshing ? 'spin' : ''}>↻</span>
          <span>{refreshing ? 'Refreshing' : 'Refresh'}</span>
        </button>
      </div>
    </header>
  );
}

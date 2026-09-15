import { useMemo } from 'react';
import SectionState from './SectionState';
import Reveal from './Reveal';
import { formatDistanceToNow } from '../utils/timeUtils';

/**
 * 02 · What's moving — a live frequency readout of real theme counts.
 * No momentum values are fabricated: bars visualize actual story counts and
 * the recency column shows the newest activity per theme. Clicking a row
 * filters the intelligence feed (existing product behavior).
 */
export default function MomentumBoard({ themes, activeCategory, onSelectTheme, loading, error, onRetry }) {
  const rows = useMemo(() => {
    if (!themes || themes.length === 0) return [];
    const meaningful = themes.filter(t => t.category && t.category !== 'Other');
    const pool = meaningful.length > 0 ? meaningful : themes;
    const sorted = [...pool]
      .sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0))
      .slice(0, 6);
    const max = Math.max(...sorted.map(t => Number(t.count) || 0), 1);
    return sorted.map(t => {
      const count = Number(t.count) || 0;
      // Relative activity derived from the real count distribution
      // — no fabricated trend values.
      const signal = count === max ? 'Most active' : count >= max * 0.4 ? 'Active' : 'Lower activity';
      return {
        ...t,
        count,
        pct: Math.max(4, Math.round((count / max) * 100)),
        signal,
      };
    });
  }, [themes]);

  if (loading || error || rows.length === 0) return <SectionState number="02" title="What's moving" loading={loading} error={error} onRetry={onRetry} empty="No category activity available in the current window." />;

  return (
    <section className="band" aria-label="What's moving">
      <Reveal>
        <header className="band-head">
          <span className="band-no">02</span>
          <div className="band-title">
            <h2>What&rsquo;s moving</h2>
            <span className="m-label m-sub">Relative category activity in the current window</span>
          </div>
          <div className="band-aside">
            <span className="m-label">Click a theme to filter</span>
          </div>
        </header>
      </Reveal>

      <Reveal delay={80}>
        <div className="mo">
          {rows.map((theme, i) => {
            const active = activeCategory === theme.category;
            return (
              <button
                key={theme.category}
                type="button"
                className={`mo-row${active ? ' on' : ''}`}
                aria-pressed={active}
                style={{ '--i': i, '--w': `${theme.pct}%` }}
                onClick={() => onSelectTheme(theme.category)}
              >
                <span className="mo-name">
                  <span className={`dot ${i === 0 ? 'dot-live' : 'dot-med'}`} aria-hidden="true" />
                  {theme.category}
                </span>
                <span className="mo-track" aria-hidden="true">
                  <span className="mo-bar" />
                  <span className="mo-tick" />
                </span>
                <span className="mo-count">{theme.count}</span>
                <span className="mo-signal">{theme.signal}</span>
                <span className="mo-latest">
                  {theme.latestUpdatedAt ? formatDistanceToNow(theme.latestUpdatedAt) : '—'}
                </span>
              </button>
            );
          })}
        </div>
      </Reveal>
    </section>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { fetchEvents, fetchStatus, triggerRefresh } from '../utils/api';
import EventCard from './EventCard';
import EventDetailModal from './EventDetailModal';
import Filters from './Filters';
import SystemStatus from './SystemStatus';
import TopNav from './TopNav';
import { formatDistanceToNow } from '../utils/timeUtils';

const DEFAULT_FILTERS = {
  category: 'All',
  timeframe: '24h',
  search: '',
  sort: 'importance',
  onlyHighConfidence: false,
  onlyImportant: false,
};

function HeroPanel({ status, storyCount, lastUpdated }) {
  return (
    <section className="hero-panel glass-panel">
      <div className="hero-copy">
        <span className="hero-eyebrow">AI INTELLIGENCE</span>
        <h1>The AI world, without the noise.</h1>
        <p>Important developments from the sources that matter — filtered, clustered and summarized for you.</p>
      </div>

      <div className="hero-details">
        <div className="hero-detail-card">
          <span className="hero-detail-label">Live monitoring</span>
          <strong>{status ? `${status.sources.total} source${status.sources.total === 1 ? '' : 's'}` : 'Loading sources...'}</strong>
        </div>
        <div className="hero-detail-card">
          <span className="hero-detail-label">Latest update</span>
          <strong>{lastUpdated ? formatDistanceToNow(lastUpdated) : 'Checking status...'}</strong>
        </div>
        <div className="hero-detail-card">
          <span className="hero-detail-label">Active stories</span>
          <strong>{storyCount}</strong>
        </div>
      </div>
    </section>
  );
}

function FeaturedSection({ events, onSelect }) {
  if (!events || events.length === 0) return null;

  const main = events[0];
  const side = events.slice(1, 4);

  return (
    <section className="featured-section">
      <div className="featured-header">
        <div>
          <p className="eyebrow">What matters now</p>
          <h2>Top AI events shaping the day.</h2>
        </div>
      </div>

      <div className="featured-grid">
        <article
          className="featured-card featured-card-main glass-panel"
          onClick={() => onSelect(main)}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && onSelect(main)}
          aria-label={main.title}
        >
          <div className="featured-meta">
            <span className="featured-category">{main.category || 'AI News'}</span>
            <span className="featured-time">Updated {formatDistanceToNow(main.updatedAt || main.discoveredAt)}</span>
          </div>
          <h3>{main.title}</h3>
          {main.summary && <p>{main.summary}</p>}
          {main.whyItMatters && (
            <div className="featured-matters">
              <span>Why it matters</span>
              <p>{main.whyItMatters}</p>
            </div>
          )}
          <div className="featured-footer">
            <span>{main.sources?.length || 0} source{(main.sources?.length || 0) !== 1 ? 's' : ''}</span>
            <span>{main.confidenceLabel || 'Medium'} confidence</span>
          </div>
        </article>

        <div className="featured-card-stack">
          {side.map(event => (
            <article
              key={event.id}
              className="featured-card featured-card-small glass-panel"
              onClick={() => onSelect(event)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && onSelect(event)}
              aria-label={event.title}
            >
              <div className="featured-meta">
                <span className="featured-category">{event.category || 'AI News'}</span>
                <span className="featured-time">{formatDistanceToNow(event.updatedAt || event.discoveredAt)}</span>
              </div>
              <h4>{event.title}</h4>
              {event.summary && <p>{event.summary}</p>}
              <div className="featured-footer">
                <span>{event.sources?.length || 0} sources</span>
                <span>{event.importanceScore ? `${Math.round(event.importanceScore)}% importance` : 'Scoring…'}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function TrendingThemes({ events }) {
  if (!events || events.length === 0) return null;

  const counts = {};
  for (const event of events) {
    const label = event.category || 'AI News';
    counts[label] = (counts[label] || 0) + 1;
  }

  const themes = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, count]) => ({ category, count }));

  if (!themes.length) return null;

  return (
    <section className="trending-section">
      <div className="section-heading-row">
        <p className="eyebrow">What’s moving</p>
        <h2>Emerging themes in the feed.</h2>
      </div>
      <div className="trending-grid">
        {themes.map(({ category, count }) => (
          <div className="trend-card glass-panel" key={category}>
            <span className="trend-card-label">{category}</span>
            <strong>{count}</strong>
            <small>stories</small>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Dashboard({ theme, themePreference, onThemeChange }) {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showScroll, setShowScroll] = useState(false);
  const [showIntroOverlay, setShowIntroOverlay] = useState(true);
  const [filters, setFilters] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_FILTERS;
    try {
      const saved = JSON.parse(localStorage.getItem('ai-intelligence-filters') || 'null');
      return saved ? { ...DEFAULT_FILTERS, ...saved } : DEFAULT_FILTERS;
    } catch {
      return DEFAULT_FILTERS;
    }
  });

  useEffect(() => {
    const timer = setTimeout(() => setShowIntroOverlay(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai-intelligence-filters', JSON.stringify(filters));
    }
  }, [filters]);

  const lastUpdated = useMemo(() => {
    const times = events
      .map(evt => new Date(evt.updatedAt || evt.discoveredAt))
      .filter(date => !Number.isNaN(date.getTime()));
    if (!times.length) return null;
    return new Date(Math.max(...times.map(date => date.getTime()))).toISOString();
  }, [events]);

  useEffect(() => {
    loadStatus();
    loadEvents();

    const statusInterval = setInterval(loadStatus, 45000);
    const refreshInterval = setInterval(loadEvents, 60000);
    return () => {
      clearInterval(statusInterval);
      clearInterval(refreshInterval);
    };
  }, [filters.sort]);

  useEffect(() => {
    const handleScroll = () => setShowScroll(window.scrollY > 320);
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  async function loadEvents() {
    try {
      setLoading(true);
      const data = await fetchEvents({ limit: 300, sort: filters.sort });
      setEvents(data);
      setError(null);
    } catch (e) {
      setError('Unable to refresh right now. Your existing stories are still available.');
    } finally {
      setLoading(false);
    }
  }

  async function loadStatus() {
    try {
      const data = await fetchStatus();
      setStatus(data);
    } catch (e) {
      console.warn('Status fetch failed', e);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await triggerRefresh();
      await loadEvents();
      await loadStatus();
      setError(null);
    } catch (e) {
      setError('Unable to refresh right now. Your existing stories are still available.');
    } finally {
      setRefreshing(false);
    }
  }

  const filteredEvents = useMemo(() => {
    let result = [...events];

    if (filters.category && filters.category !== 'All') {
      result = result.filter(e => e.category === filters.category);
    }

    if (filters.onlyHighConfidence) {
      result = result.filter(e => (e.confidenceLabel || '').toLowerCase() === 'high');
    }

    if (filters.onlyImportant) {
      result = result.filter(e => (e.importanceScore || 0) >= 70);
    }

    if (filters.timeframe) {
      const hours = filters.timeframe === '6h' ? 6 : filters.timeframe === '24h' ? 24 : 24 * 7;
      const cutoff = new Date(Date.now() - hours * 3600 * 1000);
      result = result.filter(e => new Date(e.updatedAt || e.discoveredAt) > cutoff);
    }

    if (filters.search && filters.search.trim()) {
      const query = filters.search.trim().toLowerCase();
      result = result.filter(e =>
        (e.title || '').toLowerCase().includes(query) ||
        (e.summary || '').toLowerCase().includes(query) ||
        (e.category || '').toLowerCase().includes(query)
      );
    }

    return result;
  }, [events, filters]);

  const featuredEvents = filteredEvents.slice(0, 4);

  return (
    <div className="app-shell">
      <TopNav
        activeCategory={filters.category}
        onNavigate={category => setFilters(prev => ({ ...prev, category }))}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        status={status}
        theme={theme}
        themePreference={themePreference}
        onThemeChange={onThemeChange}
      />

      {showIntroOverlay && (
        <div className="startup-overlay" aria-hidden="true">
          <div className="startup-center glass-panel">
            <div className="startup-brand">AI INTELLIGENCE</div>
            <div className="startup-title">Synchronizing your intelligence stream</div>
            <div className="startup-loader">
              <div className="loader-ring" />
              <div className="loader-text">Initializing the future...</div>
            </div>
          </div>
        </div>
      )}

      <main className="main-content">
        <div className="background-atmosphere" aria-hidden="true" />
        <HeroPanel status={status} storyCount={filteredEvents.length} lastUpdated={lastUpdated} />

        {error && (
          <div className="status-banner" role="alert">
            <div className="status-banner-icon">⚠</div>
            <div>
              <strong>Something interrupted the signal.</strong>
              <p>Your existing intelligence is still available.</p>
            </div>
          </div>
        )}

        <FeaturedSection events={featuredEvents} onSelect={setSelected} />
        <TrendingThemes events={filteredEvents} />

        <Filters filters={filters} onChange={setFilters} />

        <SystemStatus status={status} refreshing={refreshing} onRefresh={handleRefresh} />

        {loading ? (
          <div className="events-grid animate" aria-live="polite">
            {Array.from({ length: 6 }).map((_, index) => (
              <div className="event-card event-skeleton" key={index} style={{ '--index': index }}>
                <div className="skeleton-line short" />
                <div className="skeleton-line medium" />
                <div className="skeleton-line" />
                <div className="skeleton-line small" />
              </div>
            ))}
          </div>
        ) : (
          <div className="events-grid animate" aria-live="polite">
            {filteredEvents.length === 0 ? (
              <div className="events-empty glass-panel">
                <h3>Waiting for the next signal.</h3>
                <p>The intelligence feed is monitoring the sources that matter.</p>
                <button type="button" className="btn-primary" onClick={handleRefresh}>Refresh</button>
              </div>
            ) : (
              filteredEvents.map((event, idx) => (
                <EventCard key={event.id} index={idx} event={event} onClick={setSelected} />
              ))
            )}
          </div>
        )}
      </main>

      {selected && <EventDetailModal event={selected} onClose={() => setSelected(null)} />}
      <button
        type="button"
        className={`scroll-top-button${showScroll ? ' visible' : ''}`}
        onClick={scrollToTop}
        aria-label="Scroll back to top"
      >
        ↑
      </button>
    </div>
  );
}

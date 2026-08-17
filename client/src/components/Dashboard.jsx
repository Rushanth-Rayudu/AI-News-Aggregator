import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchEvents, fetchStatus, fetchThemes, fetchEventsSince, triggerRefresh } from '../utils/api';
import EventCard from './EventCard';
import EventDetailModal from './EventDetailModal';
import Filters from './Filters';
import SystemStatus from './SystemStatus';
import TopNav from './TopNav';
import { formatDistanceToNow } from '../utils/timeUtils';
import { getWatchlist, saveWatchlist, WATCHLIST_TOPICS, getLastVisit, saveLastVisit } from '../utils/storage';
import { eventMatchesWatchlist } from '../utils/eventIntelligence';

const PAGE_SIZE = 50;
const POLL_INTERVAL = 60000;

const DEFAULT_FILTERS = {
  category: 'All',
  timeframe: '24h',
  search: '',
  sort: 'importance',
  onlyHighConfidence: false,
  onlyImportant: false,
  forYou: false,
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

function ThemesSection({ themes, activeCategory, onSelectTheme }) {
  if (!themes || themes.length === 0) return null;

  return (
    <section className="trending-section">
      <div className="section-heading-row">
        <p className="eyebrow">What’s moving</p>
        <h2>Current AI themes in the feed.</h2>
      </div>
      <div className="trending-grid">
        {themes.slice(0, 5).map(theme => (
          <button
            key={theme.category}
            type="button"
            className={`trend-card glass-panel${activeCategory === theme.category ? ' active' : ''}`}
            onClick={() => onSelectTheme(theme.category)}
            aria-pressed={activeCategory === theme.category}
          >
            <span className="trend-card-label">{theme.category}</span>
            <strong>{theme.count}</strong>
            <small>
              {theme.count === 1 ? 'story' : 'stories'}
              {theme.latestUpdatedAt ? ` · ${formatDistanceToNow(theme.latestUpdatedAt)}` : ''}
            </small>
          </button>
        ))}
      </div>
    </section>
  );
}

function WatchlistSection({ watchlist, onToggle, onClear }) {
  return (
    <section className="watchlist-panel glass-panel">
      <div className="watchlist-heading">
        <div>
          <p className="eyebrow">Watchlist</p>
          <h3>Follow the topics that matter to you.</h3>
        </div>
        {watchlist.length > 0 && (
          <button type="button" className="btn-icon" onClick={onClear}>Clear</button>
        )}
      </div>
      <div className="topic-chips">
        {WATCHLIST_TOPICS.map(topic => {
          const active = watchlist.includes(topic.id);
          return (
            <button
              key={topic.id}
              type="button"
              className={`topic-pill${active ? ' active' : ''}`}
              aria-pressed={active}
              onClick={() => onToggle(topic.id)}
            >
              {active ? '★' : '☆'} {topic.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function dedupeById(list) {
  const seen = new Set();
  return list.filter(item => {
    if (!item || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export default function Dashboard({ theme, themePreference, onThemeChange }) {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState(null);
  const [themes, setThemes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showScroll, setShowScroll] = useState(false);
  const [showIntroOverlay, setShowIntroOverlay] = useState(true);
  const [pendingNewEvents, setPendingNewEvents] = useState([]);
  const [visitInfo, setVisitInfo] = useState(null);
  const [watchlist, setWatchlist] = useState(() => getWatchlist());
  const [filters, setFilters] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_FILTERS;
    try {
      const saved = JSON.parse(localStorage.getItem('ai-intelligence-filters') || 'null');
      return saved ? { ...DEFAULT_FILTERS, ...saved } : DEFAULT_FILTERS;
    } catch {
      return DEFAULT_FILTERS;
    }
  });

  const eventsRef = useRef(events);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);
  const initialVisitRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowIntroOverlay(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai-intelligence-filters', JSON.stringify(filters));
    }
  }, [filters]);

  useEffect(() => {
    saveWatchlist(watchlist);
  }, [watchlist]);

  const lastUpdated = useMemo(() => {
    const times = events
      .map(evt => new Date(evt.updatedAt || evt.discoveredAt))
      .filter(date => !Number.isNaN(date.getTime()));
    if (!times.length) return null;
    return new Date(Math.max(...times.map(date => date.getTime()))).toISOString();
  }, [events]);

  // Initial status + themes
  useEffect(() => {
    loadStatus();
    loadThemes();
  }, []);

  // Load/reload the feed when primary server-side filters change
  useEffect(() => {
    loadEvents({ page: 0, append: false });
    // loadEvents is intentionally re-created each render; the data deps below
    // fully describe when a reload is required.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.sort, filters.category, filters.timeframe]);

  // Poll for fresh stories without reordering the page (see pollForNewEvents)
  useEffect(() => {
    const interval = setInterval(() => pollForNewEvents(), POLL_INTERVAL);
    return () => clearInterval(interval);
    // pollForNewEvents reads only refs + the filters listed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.category, filters.timeframe, filters.sort]);

  useEffect(() => {
    const handleScroll = () => setShowScroll(window.scrollY > 320);
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  function applyServerFilters(params) {
    if (filters.category && filters.category !== 'All') params.category = filters.category;
    if (filters.timeframe) params.timeframe = filters.timeframe;
    return params;
  }

  async function loadEvents({ page = 0, append = false } = {}) {
    try {
      if (!append) setLoading(true);
      // Fast initial page (50) + server-side offset pagination. Server applies
      // category/timeframe via SQL so recent events survive (client filtering
      // alone on a small slice excluded them before).
      const data = await fetchEvents(applyServerFilters({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        sort: filters.sort,
      }));
      setEvents(prev => (append ? dedupeById([...prev, ...data]) : data));
      setHasMore(data.length === PAGE_SIZE);
      setError(null);

      // Record a "successful visit" (localStorage) on the first clean load,
      // then answer "what changed since my last visit".
      if (!append && !initialVisitRef.current) {
        initialVisitRef.current = true;
        computeVisitInfo();
      }
    } catch {
      setError('Unable to refresh right now. Your existing stories are still available.');
    } finally {
      if (!append) setLoading(false);
    }
  }

  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const offset = eventsRef.current.length;
      const data = await fetchEvents(applyServerFilters({
        limit: PAGE_SIZE,
        offset,
        sort: filters.sort,
      }));
      setEvents(prev => dedupeById([...prev, ...data]));
      setHasMore(data.length === PAGE_SIZE);
      setError(null);
    } catch {
      setError('Unable to load more right now.');
    } finally {
      setLoadingMore(false);
    }
  }

  async function computeVisitInfo() {
    try {
      const lastVisit = getLastVisit();
      const data = await fetchEventsSince(lastVisit ? lastVisit.visitedAt : null, 50);
      if (lastVisit && data.count > 0) {
        const highlights = data.events
          .slice()
          .sort((a, b) => (b.importanceScore || 0) - (a.importanceScore || 0))
          .slice(0, 5);
        setVisitInfo({ count: data.count, events: highlights });
      } else {
        setVisitInfo(null);
      }
      saveLastVisit(new Date().toISOString());
    } catch {
      setVisitInfo(null);
    }
  }

  function markVisitSeen() {
    setVisitInfo(null);
    saveLastVisit(new Date().toISOString());
  }

  async function pollForNewEvents() {
    try {
      const data = await fetchEvents(applyServerFilters({
        limit: PAGE_SIZE,
        sort: 'latest',
      }));
      const currentIds = new Set(eventsRef.current.map(e => e.id));
      const fresh = data.filter(e => !currentIds.has(e.id));
      if (fresh.length > 0) {
        setPendingNewEvents(prev => dedupeById([...prev, ...fresh]));
      }
    } catch {
      // Best-effort polling — never disrupt the page for a transient failure.
    }
  }

  function applyNewEvents() {
    if (!pendingNewEvents.length) return;
    const currentIds = new Set(eventsRef.current.map(e => e.id));
    const fresh = dedupeById(pendingNewEvents.filter(e => !currentIds.has(e.id)))
      .map(e => ({ ...e, isNew: true }));

    if (fresh.length === 0) {
      setPendingNewEvents([]);
      return;
    }

    // Do NOT reorder the page: prepend only for the "latest" sort; otherwise
    // append below the existing stories with a subtle "New" badge.
    setEvents(prev => (
      filters.sort === 'latest'
        ? dedupeById([...fresh, ...prev])
        : dedupeById([...prev, ...fresh])
    ));
    setPendingNewEvents([]);
  }

  async function loadStatus() {
    try {
      const data = await fetchStatus();
      setStatus(data);
    } catch (e) {
      console.warn('Status fetch failed', e);
    }
  }

  async function loadThemes() {
    try {
      const data = await fetchThemes();
      setThemes(data);
    } catch (e) {
      console.warn('Themes fetch failed', e);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await triggerRefresh();
      await loadEvents({ page: 0, append: false });
      await loadStatus();
      await loadThemes();
      setError(null);
    } catch {
      setError('Unable to refresh right now. Your existing stories are still available.');
    } finally {
      setRefreshing(false);
    }
  }

  function toggleTopic(id) {
    setWatchlist(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }

  function clearWatchlist() {
    setWatchlist([]);
    setFilters(prev => ({ ...prev, forYou: false }));
  }

  function selectTheme(category) {
    setFilters(prev => ({ ...prev, category: prev.category === category ? 'All' : category }));
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

    if (filters.forYou) {
      result = watchlist.length > 0
        ? result.filter(e => eventMatchesWatchlist(watchlist, e))
        : [];
    }

    // NOTE: timeframe (6h/24h/7d) is applied server-side via ?timeframe= to keep
    // SQL and client semantics in sync; do not re-filter by timeframe here (a
    // client-side duplicate filter incorrectly dropped events near the window edge).

    if (filters.search && filters.search.trim()) {
      const query = filters.search.trim().toLowerCase();
      result = result.filter(e =>
        (e.title || '').toLowerCase().includes(query) ||
        (e.summary || '').toLowerCase().includes(query) ||
        (e.category || '').toLowerCase().includes(query)
      );
    }

    return result;
  }, [events, filters, watchlist]);

  const featuredEvents = filteredEvents.slice(0, 4);

  const forYouEmpty = watchlist.length === 0;
  const showForYouEmptyState = filters.forYou && watchlist.length === 0;

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

        {visitInfo && visitInfo.count > 0 && (
          <section className="visit-banner glass-panel">
            <div className="visit-banner-head">
              <div>
                <p className="eyebrow">Since your last visit</p>
                <h3>
                  {visitInfo.count} new development{visitInfo.count !== 1 ? 's' : ''}
                </h3>
              </div>
              <button type="button" className="btn-icon" onClick={markVisitSeen}>Dismiss</button>
            </div>
            {visitInfo.events.length > 0 && (
              <div className="visit-items">
                {visitInfo.events.map(evt => (
                  <button
                    key={evt.id}
                    type="button"
                    className="visit-item"
                    onClick={() => setSelected(evt)}
                  >
                    <span className="visit-item-importance">
                      {Math.round(Math.min(100, evt.importanceScore || 0))}%
                    </span>
                    <span className="visit-item-title">{evt.title}</span>
                    <span className="visit-item-time">{formatDistanceToNow(evt.discoveredAt)}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {error && (
          <div className="status-banner" role="alert">
            <div className="status-banner-icon">⚠</div>
            <div>
              <strong>Something interrupted the signal.</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        <FeaturedSection events={featuredEvents} onSelect={setSelected} />
        <ThemesSection themes={themes} activeCategory={filters.category} onSelectTheme={selectTheme} />

        <Filters filters={filters} onChange={setFilters} watchlistEmpty={forYouEmpty} />
        <WatchlistSection watchlist={watchlist} onToggle={toggleTopic} onClear={clearWatchlist} />

        <SystemStatus status={status} refreshing={refreshing} onRefresh={handleRefresh} />

        {pendingNewEvents.length > 0 && (
          <div className="new-stories-banner" role="status">
            <button type="button" className="new-stories-button" onClick={applyNewEvents}>
              ↑ {pendingNewEvents.length} new development{pendingNewEvents.length !== 1 ? 's' : ''}
            </button>
            <span className="new-stories-note">Click to add to your feed</span>
          </div>
        )}

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
              showForYouEmptyState ? (
                <div className="events-empty glass-panel">
                  <h3>Your For You feed is empty.</h3>
                  <p>Follow topics in the Watchlist above to see tailored stories.</p>
                </div>
              ) : (
                <div className="events-empty glass-panel">
                  <h3>Waiting for the next signal.</h3>
                  <p>The intelligence feed is monitoring the sources that matter.</p>
                  <button type="button" className="btn-primary" onClick={handleRefresh}>Refresh</button>
                </div>
              )
            ) : (
              filteredEvents.map((event, idx) => (
                <EventCard key={event.id} index={idx} event={event} onClick={setSelected} />
              ))
            )}
          </div>
        )}

        {!loading && filteredEvents.length > 0 && hasMore && (
          <div className="load-more-wrap">
            <button
              type="button"
              className="btn-secondary"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
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

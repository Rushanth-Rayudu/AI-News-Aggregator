import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchTopEvents, fetchEvents, fetchStatus, fetchThemes, fetchEventsSince, fetchSources } from '../utils/api';
import { getWatchlist, saveWatchlist, getLastVisit, saveLastVisit } from '../utils/storage';
import { parseTimestamp } from '../utils/timeUtils';


import { DEFAULT_FILTERS, useDashboardLocation } from '../utils/dashboardLocation';
import TopNav from './TopNav';
import SituationBand from './SituationBand';
import AnalystBrief from './AnalystBrief';
import TopEvents from './TopEvents';
import MomentumBoard from './MomentumBoard';
import Filters from './Filters';
import EventCard from './EventCard';
import SystemStatus from './SystemStatus';
import EventDetailModal from './EventDetailModal';
import BootLoader from './BootLoader';
import Reveal from './Reveal';
import ManageFollowing from './ManageFollowing';


const PAGE_SIZE = 50;
const POLL_INTERVAL = 60000;
const BOOT_HARD_CAP_MS = 1200;



function dedupeById(list) {
  const seen = new Set();
  return list.filter(item => {
    if (!item || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function Footer() {
  return (
    <footer className="foot">
      <div className="foot-in">
        <span className="product-name">AI News Aggregator</span>
        <span className="grow" aria-hidden="true" />
        <span>V.RUSHANTH RAYUDU</span>
        <a href="https://github.com/Rushanth-Rayudu" target="_blank" rel="noopener noreferrer">
          GitHub ↗
        </a>
      </div>
    </footer>
  );
}

function FeedSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <div className="card card-skel" key={index} aria-hidden="true">
          <div className="card-top">
            <span className="skel h7 w20" />
            <span className="skel h7 w40 skel-end" />
          </div>
          <span className="skel w85" />
          <span className="skel w60" />
          <span className="skel h7 w40" />
          <div className="card-meta">
            <span className="skel h7 w40" />
            <span className="skel h7 w20 skel-end" />
          </div>
        </div>
      ))}
    </>
  );
}
export default function Dashboard({ theme, onThemeChange }) {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState(null);
  const [sources, setSources] = useState(null);
  const [sourcesError, setSourcesError] = useState(false);
  const [statusError, setStatusError] = useState(false);
  const requestVersion = useRef(0);
  const feedCheckedAt = useRef(Date.now());
  const [themes, setThemes] = useState([]);
  const [themesLoading, setThemesLoading] = useState(true);
  const [themesError, setThemesError] = useState(false);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [featuredError, setFeaturedError] = useState(false);
  const { filters, setFilters, selected, openEvent, closeEvent, dossierLoading, dossierError } = useDashboardLocation();
  const [manageFollowing, setManageFollowing] = useState(false);
  const [featuredEvents, setFeaturedEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showScroll, setShowScroll] = useState(false);
  const [bootDone, setBootDone] = useState(false);
  const [bootMounted, setBootMounted] = useState(true);
  const [pendingNewEvents, setPendingNewEvents] = useState([]);
  const [visitInfo, setVisitInfo] = useState(null);
  const [watchlist, setWatchlist] = useState(() => getWatchlist());

  const eventsRef = useRef(events);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);
  const initialVisitRef = useRef(false);

  /* Boot overlay: dismissed the moment real data is ready, hard-capped so it
     can never trap the page. */
  useEffect(() => {
    const cap = setTimeout(() => setBootDone(true), BOOT_HARD_CAP_MS);
    return () => clearTimeout(cap);
  }, []);
  useEffect(() => {
    if (!loading) setBootDone(true);
  }, [loading]);
  useEffect(() => {
    if (!bootDone) return undefined;
    const t = setTimeout(() => setBootMounted(false), 340);
    return () => clearTimeout(t);
  }, [bootDone]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('ai-intelligence-filters', JSON.stringify(filters)); } catch { /* session remains usable */ }
    }
  }, [filters]);

  useEffect(() => {
    saveWatchlist(watchlist);
  }, [watchlist]);
  const lastUpdated = useMemo(() => {
    const times = events
      .map(evt => parseTimestamp(evt.updatedAt || evt.discoveredAt))
      .filter(date => !Number.isNaN(date.getTime()));
    if (!times.length) return null;
    return new Date(Math.max(...times.map(date => date.getTime()))).toISOString();
  }, [events]);

  // Initial status + themes
  useEffect(() => {
    loadStatus();
    loadThemes();
    loadSources();
    loadFeatured();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load/reload the feed when primary server-side filters change
  useEffect(() => {
    requestVersion.current++;
    setPendingNewEvents([]);
    const timer = setTimeout(() => loadEvents({ page: 0, append: false }), 250);
    return () => { clearTimeout(timer); };
    // loadEvents is intentionally re-created each render; the data deps below
    // fully describe when a reload is required.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.sort, filters.category, filters.timeframe, filters.search, filters.source, filters.forYou, filters.onlyImportant, filters.onlyHighConfidence, watchlist]);

  // Poll for fresh stories without reordering the page (see pollForNewEvents)
  useEffect(() => {
    const interval = setInterval(() => pollForNewEvents(), POLL_INTERVAL);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.category, filters.timeframe, filters.sort, filters.search, filters.source, filters.forYou, filters.onlyImportant, filters.onlyHighConfidence, watchlist]);

  useEffect(() => {
    const handleScroll = () => setShowScroll(window.scrollY > 320);
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });

  function applyServerFilters(params) {
    if (filters.category && filters.category !== 'All') params.category = filters.category;
    if (filters.timeframe) params.timeframe = filters.timeframe;
    if(filters.search.trim()) params.q=filters.search.trim();
    if(filters.source) params.source=filters.source;
    if(filters.onlyImportant) params.onlyImportant='true';
    if(filters.onlyHighConfidence) params.onlyHighConfidence='true';
    if(filters.forYou) params.following=watchlist.join(',');
    return params;
  }

  async function loadEvents({ page = 0, append = false } = {}) {
    const version = append ? requestVersion.current : ++requestVersion.current;
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
      if(version !== requestVersion.current) return;
      setEvents(prev => (append ? dedupeById([...prev, ...data]) : data));
      if (!append) feedCheckedAt.current = Date.now();
      setHasMore(data.length === PAGE_SIZE);
      setError(null);

      // Record a "successful visit" (localStorage) on the first clean load,
      // then answer "what changed since my last visit".
      if (!append && !initialVisitRef.current) {
        initialVisitRef.current = true;
        computeVisitInfo();
      }
    } catch {
      if(version === requestVersion.current) setError('Unable to load records. Please retry.');
    } finally {
      if (!append && version === requestVersion.current) setLoading(false);
    }
  }

  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    const version=requestVersion.current;
    try {
      const offset = eventsRef.current.length;
      const data = await fetchEvents(applyServerFilters({
        limit: PAGE_SIZE,
        offset,
        sort: filters.sort,
      }));
      if(version !== requestVersion.current) return;
      setEvents(prev => dedupeById([...prev, ...data]));
      setHasMore(data.length === PAGE_SIZE);
      setError(null);
    } catch {
      if(version === requestVersion.current) setError('Unable to load more right now. Use Load more to retry.');
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
    const version = requestVersion.current;
    try {
      const data = await fetchEvents(applyServerFilters({
        limit: PAGE_SIZE,
        sort: 'latest',
      }));
      const currentIds = new Set(eventsRef.current.map(e => e.id));
      if (version !== requestVersion.current) return;
      const fresh = data.filter(e => !currentIds.has(e.id) && parseTimestamp(e.discoveredAt).getTime() > feedCheckedAt.current);
      if (fresh.length > 0) {
        setPendingNewEvents(fresh);
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

  async function loadSources() {
    setSourcesError(false);
    try { setSources(await fetchSources()); }
    catch { setSourcesError(true); }
  }

  async function loadStatus() {
    try {
      const data = await fetchStatus();
      setStatus(data);
      setStatusError(false);
    } catch {
      setStatusError(true);
    }
  }

  async function loadThemes() {
    setThemesLoading(true);
    try {
      const data = await fetchThemes();
      setThemes(data);
      setThemesError(false);
    } catch {
      setThemesError(true);
    } finally { setThemesLoading(false); }
  }

  async function loadFeatured() {
    setFeaturedLoading(true);
    try { setFeaturedEvents(await fetchTopEvents()); setFeaturedError(false); }
    catch { setFeaturedError(true); }
    finally { setFeaturedLoading(false); }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {

      await loadEvents({ page: 0, append: false });
      await loadStatus();
      await loadThemes();
      await loadFeatured();
      await loadSources();
    } catch {
      setError('Unable to check updates right now. Your existing stories are still available.');
    } finally {
      setRefreshing(false);
    }
  }

  function toggleTopic(id) {
    setWatchlist(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }

  function clearWatchlist() {
    setWatchlist([]);
  }

  function selectTheme(category) {
    setFilters(prev => ({ ...prev, category: prev.category === category ? 'All' : category }));
  }
  const filteredEvents = events;

  const showForYouEmptyState = filters.forYou && watchlist.length === 0;
  const hasActiveFilters = filters.category !== 'All'
    || filters.timeframe !== '7d'
    || Boolean(filters.search)
    || Boolean(filters.source)
    || filters.onlyHighConfidence
    || filters.onlyImportant
    || filters.forYou;

  return (
    <div>
      <TopNav
        activeCategory={filters.category}
        onNavigate={category => setFilters(prev => ({ ...prev, category }))}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        status={status}
        theme={theme}
        themePreference={theme}
        onThemeChange={onThemeChange}
      />

      {bootMounted && <BootLoader done={bootDone} />}

      <main className="mw">
        {(dossierLoading || dossierError) && <div className="alert" role={dossierError ? 'alert' : 'status'}><p>{dossierError || 'Loading event dossier...'}</p><button className="btn" onClick={closeEvent}>Return to feed</button></div>}
        <SituationBand status={status} storyCount={filteredEvents.length} lastUpdated={lastUpdated} />

        {visitInfo && visitInfo.count > 0 && (
          <AnalystBrief info={visitInfo} onOpen={openEvent} onDismiss={markVisitSeen} />
        )}

        {error && (
          <div className="alert" role="alert">
            <span aria-hidden="true">⚠</span>
            <div>
              <strong>Something interrupted the signal.</strong>
              <p>{error}</p><button type="button" className="btn" onClick={() => loadEvents()}>Retry</button>
            </div>
          </div>
        )}

        <TopEvents ingestion={status?.ingestion} events={featuredEvents} onSelect={openEvent} loading={featuredLoading} error={featuredError} onRetry={loadFeatured} />

        <MomentumBoard themes={themes} activeCategory={filters.category} onSelectTheme={selectTheme} loading={themesLoading} error={themesError} onRetry={loadThemes} />

        <section className="band" id="feed" aria-label="Intelligence feed">
          <Reveal>
            <header className="band-head">
              <span className="band-no">03</span>
              <div className="band-title">
                <h2>Intelligence feed</h2>
                <span className="m-label m-sub">The full record · filter and scan</span>
              </div>
              <div className="band-aside">
                <span className="m-label">Press / to search</span>
              </div>
            </header>
          </Reveal>

          <Reveal delay={60}>
            <Filters
              sources={sources || []}
              filters={filters}
              onChange={setFilters}
              onReset={() => setFilters(DEFAULT_FILTERS)}
              watchlist={watchlist}
              onManageFollowing={() => setManageFollowing(true)}
            />

            {pendingNewEvents.length > 0 && (
              <div className="nsb" role="status">
                <button type="button" className="btn btn-acc" onClick={applyNewEvents}>
                  ↑ {pendingNewEvents.length} new signal{pendingNewEvents.length !== 1 ? 's' : ''}
                </button>
                <span className="nsb-note">Add to the current feed without losing your place</span>
              </div>
            )}

            <div className="feed-head">
              <span className="m-label">Live records</span>
              <span className="feed-count">
                <b>{filteredEvents.length}</b> SHOWN{hasMore ? ' · MORE AVAILABLE' : ''}
              </span>
            </div>

            <div className="feed" aria-live="polite" aria-busy={loading}>
              {loading ? (
                <FeedSkeleton />
              ) : filteredEvents.length === 0 ? (
                error ? (<div className="feed-empty"><h3>Records are unavailable.</h3><p>Use Retry above to check again.</p></div>) : showForYouEmptyState ? (
                  <div className="feed-empty">
                    <h3>You're not following any interests yet.</h3>
                    <p>Choose companies or topics to see intelligence matching your interests.</p>
                    <button className="btn" onClick={() => setManageFollowing(true)}>Manage Following</button>
                  </div>
                ) : hasActiveFilters ? (
                  <div className="feed-empty">
                    <h3>No intelligence matches these filters.</h3>
                    <p>Loosen the current constraints or return to the full record.</p>
                    <button type="button" className="btn" onClick={() => setFilters(DEFAULT_FILTERS)}>Clear filters</button>
                  </div>
                ) : (
                  <div className="feed-empty">
                    <h3>Waiting for the next signal.</h3>
                    <p>No events are available in this window. Check updates or choose a wider time range.</p>
                    <button type="button" className="btn" onClick={handleRefresh} disabled={refreshing}>{refreshing ? 'Checking...' : 'Check updates'}</button>
                  </div>
                )
              ) : (
                filteredEvents.map((event, idx) => (
                  <EventCard key={event.id} index={idx} event={event} onClick={openEvent} />
                ))
              )}
            </div>

            {!loading && filteredEvents.length > 0 && hasMore && (
              <div className="loadmore">
                <button type="button" className="btn" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : 'Load more records ↓'}
                </button>
              </div>
            )}
          </Reveal>
        </section>

        <SystemStatus status={status} statusError={statusError} sources={sources} sourcesError={sourcesError} onRetrySources={loadSources} refreshing={refreshing} onRefresh={handleRefresh} />
      </main>


      {selected && <EventDetailModal key={selected.id} event={selected} watchlist={watchlist} onToggleTopic={toggleTopic} onClose={closeEvent} />}
      {manageFollowing && <ManageFollowing watchlist={watchlist} onToggle={toggleTopic} onClear={clearWatchlist} onClose={() => setManageFollowing(false)} />}

      <button
        type="button"
        className={`st${showScroll ? ' on' : ''}`}
        hidden={!showScroll}
        onClick={scrollToTop}
        aria-label="Scroll back to top"
      >
        ↑
      </button>

      <Footer />

    </div>


  );
}

import { useEffect, useRef, useState } from 'react';
import { fetchEvent } from './api';
import { DEFAULT_FILTERS, normalizeFilters, readFilters, filtersUrl, eventIdFrom } from './dashboardQuery';
export { DEFAULT_FILTERS } from './dashboardQuery';
function initialFilters() {
  let saved = DEFAULT_FILTERS;
  try { saved = JSON.parse(localStorage.getItem('ai-intelligence-filters')) || saved; } catch { /* Optional preferences. */ }
  return readFilters(window.location.search, saved);
}
export function useDashboardLocation() {
  const [filters, storeFilters] = useState(initialFilters);
  const current = useRef(filters);
  const searchEntry = useRef(false);
  const [selected, setSelected] = useState(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [dossierError, setDossierError] = useState(null);
  const request = useRef(0);
  useEffect(() => {
    let mounted = true;
    async function sync() {
      if (window.location.pathname !== '/news') return;
      searchEntry.current = false;
      const next = readFilters(window.location.search, { ...current.current, forYou:window.history.state?.followingView ?? current.current.forYou });
      current.current = next;
      storeFilters(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
      const normalized = filtersUrl(next, window.location.href);
      window.history.replaceState({ ...window.history.state, followingView:next.forYou }, '', normalized);
      const version = ++request.current;
      const id = eventIdFrom(window.location.search);
      setSelected(null); setDossierError(null); setDossierLoading(false);
      if (id === null) return;
      if (!id) { setDossierError('This event link is invalid.'); return; }
      setDossierLoading(true);
      try {
        const event = await fetchEvent(id);
        if (mounted && version === request.current) setSelected(event);
      } catch {
        if (mounted && version === request.current) setDossierError('This event is unavailable. Check updates or return to the feed.');
      } finally {
        if (mounted && version === request.current) setDossierLoading(false);
      }
    }
    sync();
    window.addEventListener('popstate', sync);
    return () => { mounted = false; window.removeEventListener('popstate',sync); };
  }, []);
  function setFilters(update) {
    const before = current.current;
    const next = normalizeFilters(typeof update === 'function' ? update(before) : update);
    if (JSON.stringify(before) === JSON.stringify(next)) return;
    const searchOnly = before.search !== next.search && Object.keys(next).every(key => key === 'search' || before[key] === next[key]);
    const path = filtersUrl(next, window.location.href);
    if (path !== window.location.pathname + window.location.search + window.location.hash || before.forYou !== next.forYou) {
      // One history entry for a continuous search edit; discrete filters push.
      window.history[searchOnly && searchEntry.current ? 'replaceState' : 'pushState']({ ...window.history.state, followingView:next.forYou }, '', path);
    }
    searchEntry.current = searchOnly;
    current.current = next;
    storeFilters(next);
  }
  function openEvent(event) {
    request.current++;
    searchEntry.current = false;
    const url = new URL(window.location.href);
    const previousId = url.searchParams.get('event');
    url.searchParams.delete('event');
    const base = url.pathname + url.search + url.hash;
    url.searchParams.set('event',String(event.id));
    window.history[previousId ? 'replaceState' : 'pushState']({ ...window.history.state, dossierBase:base }, '', url.pathname + url.search + url.hash);
    setDossierError(null); setDossierLoading(false); setSelected(event);
  }
  function closeEvent() {
    request.current++;
    setSelected(null); setDossierError(null); setDossierLoading(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('event');
    const base = url.pathname + url.search + url.hash;
    if (window.history.state?.dossierBase === base) window.history.back();
    else window.history.replaceState(window.history.state, '', base);
  }
  return { filters, setFilters, selected, openEvent, closeEvent, dossierLoading, dossierError };
}

import { useEffect, useState } from 'react';

/**
 * Minimal History-API router. Three canonical views: landing (/home),
 * dashboard (/news) and 404. The root path redirects to /home, and legacy
 * aliases (/intelligence, /intelligence-dashboard) redirect to /news using
 * replace navigation so they never enter browser history. /news is the single
 * canonical dashboard route.
 * The Express server serves index.html for all non-API paths and Vite's dev
 * server falls back to the SPA entry, so deep links and refreshes work.
 */

export const ROUTES = {
  HOME: '/home',
  NEWS: '/news',
  INTELLIGENCE: '/intelligence',
  INTELLIGENCE_DASHBOARD: '/intelligence-dashboard',
};

/** SPA navigation. Pass { replace: true } for compatibility redirects. */
export function navigate(path, { replace = false } = {}) {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === path) {
    if (!replace) window.scrollTo({ top: 0, behavior: 'auto' });
    return;
  }
  if (replace) {
    window.history.replaceState({}, '', path);
  } else {
    window.history.pushState({}, '', path);
  }
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** Subscribes to history navigation and returns the current pathname. */
export function usePath() {
  const [path, setPath] = useState(() =>
    typeof window === 'undefined' ? '/' : window.location.pathname);

  useEffect(() => {
    function sync() { setPath(window.location.pathname); }
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  return path;
}

// Lightweight localStorage-backed user preferences. No accounts, no auth —
// everything lives in the browser only.

import interests from '../../../shared/interests.json' with { type: 'json' };
export const WATCHLIST_TOPICS = interests;

const WATCHLIST_KEY = 'ai-intelligence-watchlist';
const LAST_VISIT_KEY = 'ai-intelligence-last-visit';

function hasStorage() {
  try { return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'; } catch { return false; }
}

export function getWatchlist() {
  if (!hasStorage()) return [];
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(id => WATCHLIST_TOPICS.some(t => t.id === id));
  } catch {
    return [];
  }
}

export function saveWatchlist(ids) {
  if (!hasStorage()) return;
  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(ids));
  } catch {
    // storage unavailable (private mode, quota) — feature degrades gracefully
  }
}

export function getLastVisit() {
  if (!hasStorage()) return null;
  try {
    const raw = localStorage.getItem(LAST_VISIT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.visitedAt || !Number.isFinite(Date.parse(parsed.visitedAt))) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveLastVisit(visitedAt) {
  if (!hasStorage()) return;
  try {
    localStorage.setItem(LAST_VISIT_KEY, JSON.stringify({ visitedAt }));
  } catch {
    // non-fatal
  }
}

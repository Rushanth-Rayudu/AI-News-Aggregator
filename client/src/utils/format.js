import { deriveStoryState } from './eventIntelligence';

/* Display helpers. Everything here only shapes *real* API data — nothing is
   invented. Known backend fallback strings are hidden rather than shown as
   if they were editorial content. */

const FALLBACK_SUMMARY = 'No description available.';
const FALLBACK_WHY = 'AI summarization unavailable.';

export function cleanSummary(text) {
  if (!text) return '';
  const trimmed = String(text).trim();
  if (!trimmed || trimmed === FALLBACK_SUMMARY) return '';
  return trimmed;
}

export function cleanWhy(text) {
  if (!text) return '';
  const trimmed = String(text).trim();
  if (!trimmed || trimmed === FALLBACK_WHY) return '';
  return trimmed;
}

/** importanceScore can exceed 100 in the data — clamp for display only. */
export function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function confTagClass(label) {
  const key = String(label || '').toLowerCase();
  if (key === 'high') return 'tag-hi';
  if (key === 'low') return 'tag-lo';
  return 'tag-med';
}

export function confDotClass(label) {
  const key = String(label || '').toLowerCase();
  if (key === 'high') return 'dot-hi';
  if (key === 'low') return 'dot-lo';
  return 'dot-med';
}

const STATE_MAP = {
  Breaking: { label: 'Breaking', tagCls: 'tag-break', rowCls: 'st-break g-break' },
  Developing: { label: 'Developing', tagCls: 'tag-dev', rowCls: 'st-dev g-dev' },
  Confirmed: { label: 'Confirmed', tagCls: 'tag-conf', rowCls: 'st-conf g-conf' },
};

/** Real story state (derived from source count / primary flag / age) → presentation info. */
export function storyStateOf(event) {
  const state = deriveStoryState(event);
  return state ? STATE_MAP[state] || null : null;
}

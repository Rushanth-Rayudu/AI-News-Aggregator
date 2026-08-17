import { WATCHLIST_TOPICS } from './storage';

// Intelligence helpers. Everything here is derived *only* from real event
// data that already exists in the database (timestamps, source count,
// primary-source flag, confidence, importance, credibility tiers). Nothing
// is fabricated or hard-coded.

function ageInHours(dateStr) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  return (Date.now() - date.getTime()) / 3600000;
}

/**
 * Conservative story-state derivation.
 *  - Confirmed: 3+ independent sources, or a primary announcement already
 *    rated high confidence and notably important.
 *  - Breaking: emerged within ~12h, little corroboration, still notable.
 *  - Developing: partial corroboration or medium confidence, within 7 days.
 *  - null: not enough real evidence to label — we deliberately show nothing
 *    rather than guessing.
 */
export function deriveStoryState(event) {
  if (!event) return null;

  const sources = event.sources || [];
  const sourceCount = sources.length;
  const hasPrimary = sources.some(s => s && s.isPrimary);
  const confidence = (event.confidenceLabel || '').toLowerCase();
  const importance = event.importanceScore || 0;
  const age = ageInHours(event.updatedAt || event.discoveredAt);

  if (sourceCount >= 3 || (hasPrimary && confidence === 'high' && importance >= 50)) {
    return 'Confirmed';
  }

  if (age !== null && age >= 0 && age <= 12 && sourceCount <= 1 && importance >= 40 && confidence !== 'high') {
    return 'Breaking';
  }

  if (age !== null && age >= 0 && age <= 168 && (sourceCount >= 2 || (confidence === 'medium' && importance >= 40))) {
    return 'Developing';
  }

  return null;
}

/** Why is this story rated the way it is? Built from real data only. */
export function buildConfidenceEvidence(event) {
  const sources = event.sources || [];
  const primary = sources.find(s => s && s.isPrimary);
  const tiers = [...new Set(sources.map(s => s.credibilityTier).filter(Boolean))].sort((a, b) => a - b);
  const evidence = [];

  if (primary) {
    evidence.push(`Primary announcement from ${primary.sourceName}`);
  } else if (sources.length > 0) {
    evidence.push(`Reported by ${sources.length} source${sources.length !== 1 ? 's' : ''}`);
  }

  if (sources.length >= 3) {
    evidence.push(`Corroborated across ${sources.length} independent reports`);
  }

  if (tiers.length > 0) {
    evidence.push(`Best available source credibility tier: ${tiers[0]}`);
  }

  if (sources.length === 1 && !primary) {
    evidence.push('Single-source report — limited independent confirmation');
  }

  if (event.confidenceScore != null) {
    evidence.push(`Automated confidence score: ${event.confidenceScore}/100`);
  }

  return evidence;
}

/**
 * Timeline built only from real timestamps: the event's discovery/update time
 * plus each source article's publish time. Items without a valid timestamp are
 * dropped — nothing is synthesized.
 */
export function buildTimeline(event) {
  if (!event) return [];

  const items = [];
  if (event.discoveredAt) items.push({ at: event.discoveredAt, label: 'Discovered', kind: 'discovered' });
  if (event.updatedAt) items.push({ at: event.updatedAt, label: 'Updated', kind: 'updated' });

  for (const src of event.sources || []) {
    if (!src.publishedAt) continue;
    items.push({ at: src.publishedAt, label: `Reported by ${src.sourceName}`, kind: 'source', source: src });
  }

  const seen = new Set();
  const deduped = [];
  for (const item of items) {
    const key = `${item.at}|${item.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped
    .filter(item => !Number.isNaN(new Date(item.at).getTime()))
    .sort((a, b) => new Date(a.at) - new Date(b.at));
}

/** Case-insensitive, word-boundary matching for watchlist topics. */
export function topicMatchesEvent(topic, event) {
  const text = [
    event.title,
    event.summary,
    event.category,
    ...(event.sources || []).map(s => s.sourceName),
  ].filter(Boolean).join(' ').toLowerCase();

  return topic.keywords.some(keyword => {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`).test(text);
  });
}

/** Does this event match any of the followed watchlist topics? */
export function eventMatchesWatchlist(watchlistIds, event) {
  const topics = WATCHLIST_TOPICS.filter(t => watchlistIds.includes(t.id));
  if (topics.length === 0) return false;
  return topics.some(topic => topicMatchesEvent(topic, event));
}

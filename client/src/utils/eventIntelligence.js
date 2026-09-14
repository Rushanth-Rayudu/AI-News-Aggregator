import { WATCHLIST_TOPICS } from './storage.js';
import { parseTimestamp } from './timeUtils.js';

// Intelligence helpers. Everything here is derived *only* from real event
// data that already exists in the database (timestamps, source count,
// primary-source flag, confidence, importance, credibility tiers). Nothing
// is fabricated or hard-coded.

function ageInHours(dateStr) {
  const date = parseTimestamp(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  return (Date.now() - date.getTime()) / 3600000;
}

/**
 * Conservative story-state derivation.
 *  - Confirmed: 3+ independent sources, or a primary announcement already
 *    rated high confidence and notably important.
 *  - Breaking: published within two hours, highly significant and urgent.
 *  - Developing: partial corroboration or medium confidence, within 7 days.
 *  - null: not enough real evidence to label — we deliberately show nothing
 *    rather than guessing.
 */
export function deriveStoryState(event) {
  if (!event) return null;

  const sources = event.sources || [];
  const sourceCount = new Set(sources.map(s=>s.organization || s.sourceName)).size;
  const hasPrimary = sources.some(s => s && s.isPrimary);
  const confidence = (event.confidenceLabel || '').toLowerCase();
  const importance = event.importanceScore || 0;
  const datedSources = sources.map(s => parseTimestamp(s.publishedAt).getTime()).filter(Number.isFinite);
  const age = ageInHours(datedSources.length ? Math.min(...datedSources) : event.discoveredAt);

  if (confidence === 'high' && (hasPrimary || sourceCount >= 3)) {
    return 'Confirmed';
  }

  if (age !== null && age >= 0 && age <= 2 && importance >= 90 && confidence !== 'low' && /\b(launch|release|announc|outage|breach|acquir|ban|emergency)/i.test(event.title || '')) {
    return 'Breaking';
  }

  if (age !== null && age >= 0 && age <= 168 && importance >= 70 && sourceCount >= 2 && !hasPrimary) {
    return 'Developing';
  }

  return null;
}

/** Why is this story rated the way it is? Built from real data only. */
export function buildConfidenceEvidence(event) {
 const sources=event.sources||[];
 const organizations=new Set(sources.map(s=>s.organization||s.sourceName).filter(Boolean));
 const primary=sources.find(s=>s.isPrimary);
 return [primary?'Official source: '+primary.sourceName:'No primary confirmation yet',
   sources.length+' source document'+(sources.length===1?'':'s'),
   organizations.size+' publishing organization'+(organizations.size===1?'':'s'),
   organizations.size>1?'Multiple organizations cover this event; shared sourcing may still exist.':'Single organization — limited independent evidence.',
   'Confidence is an editorial heuristic, not a probability of truth.'];
}

export function evidenceLabel(event) {
  const sources = event.sources || [];
  if (sources.some(s => s.isPrimary)) return 'Official source';
  const count = new Set(sources.map(s => s.organization || s.sourceName).filter(Boolean)).size;
  return count > 1 ? `${count} publishing organizations` : count === 1 ? 'Single source' : 'Source unavailable';
}

/**
 * Timeline built only from real timestamps: the event's discovery/update time
 * plus each source article's publish time. Items without a valid timestamp are
 * dropped — nothing is synthesized.
 */
export function buildTimeline(event) {
  if (!event) return [];

  const items = [];
  if (event.discoveredAt) items.push({ at: event.discoveredAt, label: 'First detected', kind: 'discovered' });
  if (event.updatedAt && parseTimestamp(event.updatedAt).getTime() !== parseTimestamp(event.discoveredAt).getTime()) items.push({ at: event.updatedAt, label: 'Last updated', kind: 'updated' });

  for (const src of event.sources || []) {
    if (src.publishedAt) items.push({ at: src.publishedAt, label: `Reported by ${src.sourceName}`, kind: 'source', source: src });
    if (src.discoveredAt) items.push({ at: src.discoveredAt, label: `${src.isPrimary ? 'Official coverage' : 'Coverage'} added: ${src.sourceName}`, kind: 'added', source: src });
  }

  const seen = new Set();
  const deduped = [];
  for (const item of items) {
    const key = `${item.at}|${item.kind}|${item.source?.url || item.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped
    .filter(item => !Number.isNaN(parseTimestamp(item.at).getTime()))
    .sort((a, b) => parseTimestamp(a.at) - parseTimestamp(b.at));
}

/** Case-insensitive, word-boundary matching for watchlist topics. */
export function topicMatchesEvent(topic, event) {
  const text = [
    event.title,
    event.summary,
    event.category,
    event.whyItMatters,
    ...(event.sources || []).flatMap(s => [s.sourceName, s.organization, s.title]),
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

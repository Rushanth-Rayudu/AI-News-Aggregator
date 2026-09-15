import { formatDistanceToNow } from '../utils/timeUtils';
import { evidenceLabel } from '../utils/eventIntelligence';
import {
  cleanSummary,
  cleanWhy,
  storyStateOf,
} from '../utils/format';

/**
 * A single intelligence record in the main feed — a premium intelligence card:
 * state header · headline/summary/why · aligned metadata footer.
 */
export default function EventCard({ event, index = 0, onClick }) {
  const sources = event.sources || [];
  const primarySource = event.primarySource || sources[0] || {};
  let sourceUrl = null;
  try { const url = new URL(primarySource.url); if (['http:', 'https:'].includes(url.protocol)) sourceUrl = url.href; } catch { /* No usable original source. */ }
  const timeAgo = formatDistanceToNow(event.publishedAt || event.discoveredAt);
  const state = storyStateOf(event);
  const summary = cleanSummary(event.summary);
  const why = cleanWhy(event.whyItMatters);

  return (
    <article
      className={`card${state ? ` ${state.rowCls}` : ''}${event.isNew ? ' is-new' : ''}`}
      style={{ '--i': Math.min(index, 14) }}
    >
      <header className="card-top">
        <span className="card-no">{String(index + 1).padStart(2, '0')}</span>
        {state && <span className={`tag ${state.tagCls}`}>{state.label}</span>}
        <span className="card-cat">{event.category || 'AI News'}</span>
        <span className="card-time">{timeAgo}</span>
      </header>

      <h3 className="card-title">
        <button type="button" className="card-dossier" onClick={() => onClick(event)} aria-label={`Open dossier: ${event.title}`}>{event.title}</button>
        {event.isNew && <span className="tag tag-new">New</span>}
      </h3>
      {summary && <p className="card-sum">{summary}</p>}
      {why && <p className="card-why"><b>Why</b>{why}</p>}

      <footer className="card-meta">
        <span className="card-conf">
          {evidenceLabel(event)}
        </span>
        <span className="card-src" title={primarySource.sourceName || ''}>
          {primarySource.sourceName || 'Source tracking'}
        </span>
        {sourceUrl ? <a
          className="card-open"
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
        >
          Source ↗
        </a> : <span className="card-open card-unavailable" aria-label="Original source unavailable">Source unavailable</span>}
      </footer>
    </article>
  );
}
